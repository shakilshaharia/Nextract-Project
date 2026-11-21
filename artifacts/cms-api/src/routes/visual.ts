import { Router } from "express";
import { z } from "zod";
import { db } from "../db.ts";
import { requireCap, userCan } from "../lib/auth.ts";
import { logActivity } from "../lib/activity.ts";
import { getSiteBootstrap } from "../lib/content.ts";
import { HttpError, notFound, parse } from "../lib/http.ts";
import { validateVisual } from "../lib/visual.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { recordRevision } from "../lib/workflow.ts";

export const visualRouter = Router({ mergeParams: true });
visualRouter.use(requireCap("pages.edit"));
const json = (v: unknown) => v as Prisma.InputJsonValue;
const versionSchema = z.object({ version: z.number().int().min(0) });
async function load(id: string) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw notFound("Page");
  return page;
}

visualRouter.get("/", async (req, res) => {
  const page = await load(String((req.params as Record<string, string>).id));
  const path = page.slug === "home" ? "/" : `/${page.slug}`;
  const bootstrap = await getSiteBootstrap(path, { preview: true });
  const revisions = await db.pageVisualRevision.findMany({
    where: { pageId: page.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, createdAt: true, createdByName: true },
  });
  res.json({
    editorId: req.user!.id,
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      path,
      status: page.status,
    },
    layout: page.visualDraft,
    version: page.visualVersion,
    bootstrap,
    revisions,
    canPublish: userCan(req, "pages.publish"),
  });
});

visualRouter.patch("/", async (req, res) => {
  const { version } = parse(versionSchema, req.body);
  const { saveMode } = parse(
    z.object({ saveMode: z.enum(["manual", "auto"]).default("manual") }),
    req.body,
  );
  const layout = validateVisual(req.body.layout);
  const id = String((req.params as Record<string, string>).id);
  const before = await load(id);
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.page.updateMany({
      where: { id, visualVersion: version },
      data: {
        visualDraft: json(layout),
        visualVersion: { increment: 1 },
        hasChanges: true,
        updatedById: req.user!.id,
        workflowState: 'DRAFT',
        workflowVersion: { increment: 1 },
        approvedVersion: null,
        ...(before.status === 'SCHEDULED' ? { status: before.published !== null ? 'PUBLISHED' as const : 'DRAFT' as const, publishAt: null } : {}),
      },
    });
    if (!result.count)
      throw new HttpError(
        409,
        "This page changed in another editor. Reload before saving to avoid overwriting their work.",
        "conflict",
      );
    const recent =
      saveMode === "auto"
        ? await tx.pageVisualRevision.findFirst({
            where: {
              pageId: id,
              createdById: req.user!.id,
              action: "autosave",
              createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
            },
            orderBy: { createdAt: "desc" },
          })
        : null;
    if (recent)
      await tx.pageVisualRevision.update({
        where: { id: recent.id },
        data: { layout: json(layout) },
      });
    else
      await tx.pageVisualRevision.create({
        data: {
          pageId: id,
          layout: json(layout),
          action: saveMode === "auto" ? "autosave" : "draft",
          createdById: req.user!.id,
          createdByName: req.user!.name,
        },
      });
    return tx.page.findUniqueOrThrow({ where: { id } });
  });
  if (saveMode === "manual")
    logActivity(
      req,
      "visual-save",
      "page",
      `Saved visual draft for "${updated.title}"`,
      id,
    );
  if (saveMode === "manual") await recordRevision(req, 'page', id, updated.workflowVersion, 'visual-save');
  res.json({
    version: updated.visualVersion,
    updatedAt: updated.updatedAt,
    layout: updated.visualDraft,
  });
});

visualRouter.post("/restore/:revision", async (req, res) => {
  const { version } = parse(versionSchema, req.body);
  const id = String((req.params as Record<string, string>).id);
  const revision = await db.pageVisualRevision.findFirst({
    where: { id: String(req.params.revision), pageId: id },
  });
  if (!revision) throw notFound("Revision");
  const layout = validateVisual(revision.layout);
  const before = await load(id);
  await db.$transaction(async (tx) => {
    const result = await tx.page.updateMany({
      where: { id, visualVersion: version },
      data: {
        visualDraft: json(layout),
        visualVersion: { increment: 1 },
        hasChanges: true,
        updatedById: req.user!.id,
        workflowState: 'DRAFT',
        workflowVersion: { increment: 1 },
        approvedVersion: null,
        ...(before.status === 'SCHEDULED' ? { status: before.published !== null ? 'PUBLISHED' as const : 'DRAFT' as const, publishAt: null } : {}),
      },
    });
    if (!result.count)
      throw new HttpError(
        409,
        "The page changed. Reload before restoring.",
        "conflict",
      );
    await tx.pageVisualRevision.create({
      data: {
        pageId: id,
        layout: json(layout),
        action: "restore",
        createdById: req.user!.id,
        createdByName: req.user!.name,
      },
    });
  });
  logActivity(
    req,
    "visual-restore",
    "page",
    "Restored visual revision as draft",
    id,
  );
  res.json({ ok: true });
});
