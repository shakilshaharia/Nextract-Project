// Explicit local integration test. Creates only isolated test rows and removes
// those exact rows afterwards; never edits an existing page or account.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../src/app.ts";
import { db } from "../src/db.ts";
import { sha256 } from "../src/lib/auth.ts";
import { findUsage, replaceReferences } from '../src/lib/media.ts';
import type { VisualLayout } from "@workspace/cms-content";

const server = createApp().listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("No test server");
const base = `http://127.0.0.1:${address.port}`;
const tag = randomBytes(6).toString("hex");
const sessions: string[] = [];
let pageId = "";
let authorId = "";
const session = async (userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const id = sha256(token);
  sessions.push(id);
  await db.session.create({
    data: { id, userId, expiresAt: new Date(Date.now() + 600000) },
  });
  return `nextract_session=${token}`;
};
type TestPayload = {
  page: { id: string; visualLayout: VisualLayout };
  version: number;
  layout: VisualLayout;
  revisions: { id: string; action: string }[];
};
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin?: string,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      "Content-Type": "application/json",
      "X-Nextract-CSRF": "1",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: (await response.json()) as TestPayload,
  };
}
try {
  const admin = await db.user.findFirstOrThrow({
    where: { role: "SUPER_ADMIN", active: true },
  });
  const cookie = await session(admin.id);
  const author = await db.user.create({
    data: {
      email: `visual-test-${tag}@example.invalid`,
      name: "Visual integration author",
      passwordHash: "test-only-no-login",
      role: "AUTHOR",
    },
  });
  authorId = author.id;
  const authorCookie = await session(author.id);
  const created = await call(
    "/api/admin/pages",
    "POST",
    { title: `Visual integration ${tag}`, slug: `visual-test-${tag}` },
    cookie,
  );
  assert.equal(created.status, 201);
  pageId = created.data.page.id;
  const path = `/api/admin/pages/${pageId}`;
  assert.equal((await call(`${path}/visual`)).status, 401);
  assert.equal(
    (await call(`${path}/visual`, "GET", undefined, authorCookie)).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${path}/visual`,
        "PATCH",
        { version: 0, layout: {} },
        cookie,
        "https://evil.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/admin/media?kind=image&pageSize=60",
        "GET",
        undefined,
        cookie,
      )
    ).status,
    200,
  );
  const layout: VisualLayout = {
    root: { props: { title: "Integration page" } },
    content: [
      { type: "Heading", props: { id: "heading", text: "Original & correct" } },
      {
        type: "Button",
        props: { id: "button", text: "Contact us", href: "/contact" },
      },
      {
        type: "Image",
        props: {
          id: "image",
          image: {
            src: "/images/solutions/workspace-photo.jpg",
            alt: "Workspace",
            focalX: 35,
            focalY: 60,
            ratio: "4/3",
          },
        },
      },
      {
        type: "Video",
        props: {
          id: "video",
          src: "/videos/nextract-video.mp4",
          controls: true,
          muted: true,
        },
      },
    ],
  };
  let result = await call(
    `${path}/visual`,
    "PATCH",
    { version: 0, layout, saveMode: "auto" },
    cookie,
  );
  assert.equal(result.status, 200);
  let version = result.data.version;
  let bootstrap = await call(`/api/public/bootstrap?path=/visual-test-${tag}`);
  assert.equal(bootstrap.data.page, null);
  result = await call(`${path}/visual`, "GET", undefined, cookie);
  assert.deepEqual(result.data.layout, layout);
  assert.equal(result.data.revisions.length, 1);
  const firstRevision = result.data.revisions[0].id;
  assert.equal(
    (await call(`${path}/visual`, "PATCH", { version: 0, layout }, cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        `${path}/publish`,
        "POST",
        { visualVersion: version },
        authorCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `${path}/publish`,
        "POST",
        { visualVersion: version - 1 },
        cookie,
      )
    ).status,
    409,
  );
  result = await call(
    `${path}/publish`,
    "POST",
    { visualVersion: version },
    cookie,
  );
  assert.equal(result.status, 200);
  bootstrap = await call(`/api/public/bootstrap?path=/visual-test-${tag}`);
  assert.equal(
    bootstrap.data.page.visualLayout.content[0].props.text,
    "Original & correct",
  );
  const site = process.env.SITE_TEST_URL;
  if (site) {
    const publicPage = await fetch(`${site}/visual-test-${tag}`);
    assert.equal(publicPage.status, 200);
    const html = await publicPage.text();
    assert.ok(html.includes("Original &amp; correct"));
    assert.ok(html.includes("object-position:35% 60%"));
    const editor = await fetch(`${site}/visual-editor/${pageId}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(editor.status, 200);
    assert.ok((await editor.text()).includes("Opening your page"));
    const anonymousEditor = await fetch(`${site}/visual-editor/${pageId}`, {
      redirect: "manual",
    });
    assert.ok([307, 308].includes(anonymousEditor.status));
    assert.ok(anonymousEditor.headers.get("location")?.includes("/admin"));
    console.log(
      "PASS: actual Next.js route renders the published layout and image focal point; editor route accepts authenticated editors and redirects anonymous visitors.",
    );
  }
  layout.content[0].props.text = "Draft only";
  result = await call(
    `${path}/visual`,
    "PATCH",
    { version, layout, saveMode: "auto" },
    cookie,
  );
  assert.equal(result.status, 200);
  version = result.data.version;
  bootstrap = await call(`/api/public/bootstrap?path=/visual-test-${tag}`);
  assert.equal(
    bootstrap.data.page.visualLayout.content[0].props.text,
    "Original & correct",
  );
  const history = await call(`${path}/visual`, "GET", undefined, cookie);
  assert.equal(
    history.data.revisions.filter(
      (r: { action: string }) => r.action === "autosave",
    ).length,
    1,
  );
  result = await call(
    `${path}/visual/restore/${firstRevision}`,
    "POST",
    { version },
    cookie,
  );
  assert.equal(result.status, 200);
  const restored = await call(`${path}/visual`, "GET", undefined, cookie);
  assert.equal(restored.data.layout.content[0].props.text, "Draft only");
  version = restored.data.version;
  // Autosave revisions coalesce; manual and published revisions stay immutable.
  const publishedRevision = restored.data.revisions.find(
    (r: { action: string }) => r.action === "publish",
  );
  assert.ok(publishedRevision);
  assert.equal(
    (
      await call(
        `${path}/visual/restore/${publishedRevision.id}`,
        "POST",
        { version },
        cookie,
      )
    ).status,
    200,
  );
  const final = await call(`${path}/visual`, "GET", undefined, cookie);
  assert.equal(final.data.layout.content[0].props.text, "Original & correct");
  const bad = structuredClone(layout);
  bad.content[1].props.href = "#";
  result = await call(
    `${path}/visual`,
    "PATCH",
    { version: final.data.version, layout: bad },
    cookie,
  );
  assert.equal(result.status, 200);
  assert.equal(
    (
      await call(
        `${path}/publish`,
        "POST",
        { visualVersion: result.data.version },
        cookie,
      )
    ).status,
    400,
  );
  const mediaFrom=`/uploads/visual-test-${tag}.png`,mediaTo=`/uploads/visual-test-${tag}-replaced.png`;
  layout.content.push({type:'Image',props:{id:'draft-media',src:mediaFrom,alt:'Draft image'}});
  const mediaDraft=await call(`${path}/visual`,'PATCH',{version:result.data.version,layout},cookie);assert.equal(mediaDraft.status,200);
  assert.ok((await findUsage([mediaFrom])).some(u=>u.id===pageId));
  await replaceReferences(mediaFrom,mediaTo);
  const replaced=await call(`${path}/visual`,'GET',undefined,cookie);assert.ok(JSON.stringify(replaced.data.layout).includes(mediaTo));assert.ok(replaced.data.version>mediaDraft.data.version);
  assert.equal((await call(`${path}/visual`,'PATCH',{version:mediaDraft.data.version,layout},cookie)).status,409);
  console.log(
    "PASS: MySQL draft reload, autosave isolation/coalescing, media listing, publish, revisions, restore, stale version rejection, author permissions, anonymous access, CSRF, and publication checks.",
  );
} finally {
  if (pageId) {
    await db.page.delete({ where: { id: pageId } });
    await db.activityLog.deleteMany({ where: { entityId: pageId } });
  }
  if (sessions.length)
    await db.session.deleteMany({ where: { id: { in: sessions } } });
  if (authorId) await db.user.delete({ where: { id: authorId } });
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  await db.$disconnect();
}
