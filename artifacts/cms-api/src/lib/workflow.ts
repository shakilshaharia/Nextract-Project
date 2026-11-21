import type { Request } from 'express';
import { db } from '../db.ts';
import { Prisma, type Page, type Post } from '../generated/prisma/client.ts';
import { badRequest, forbidden } from './http.ts';

export type WorkflowEntity = 'page' | 'post';
type WorkflowItem = Pick<Page | Post, 'workflowState' | 'workflowVersion' | 'approvedVersion'>;

export function editWorkflow(item: WorkflowItem) {
  return { workflowState: 'DRAFT' as const, workflowVersion: { increment: 1 }, approvedVersion: null, reviewedAt: null };
}

export function assertApproved(item: WorkflowItem, req: Request) {
  if (req.user?.role === 'SUPER_ADMIN') return;
  if (item.workflowState !== 'APPROVED' || item.approvedVersion !== item.workflowVersion) {
    throw forbidden('This version must be approved before it can be published or scheduled.');
  }
}

export async function snapshotForWorkflow(entityType: WorkflowEntity, entityId: string): Promise<Prisma.InputJsonValue> {
  if (entityType === 'page') {
    const page = await db.page.findUniqueOrThrow({ where: { id: entityId } });
    return { title: page.title, slug: page.slug, excerpt: page.excerpt, featuredImage: page.featuredImage, template: page.template, sections: page.sections, seo: page.seo, visualDraft: page.visualDraft ?? null } as Prisma.InputJsonValue;
  }
  const post = await db.post.findUniqueOrThrow({ where: { id: entityId }, include: { categories: true, tags: true, author: { select: { id: true, name: true, avatarUrl: true } } } });
  return { title: post.title, slug: post.slug, type: post.type, excerpt: post.excerpt, featuredImage: post.featuredImage, featuredImageAlt: post.featuredImageAlt, featured: post.featured, solutions: post.solutions ?? null, details: post.details ?? null, contentJson: post.contentJson, contentHtml: post.contentHtml, readingMinutes: post.readingMinutes, relatedIds: post.relatedIds, seo: post.seo, categories: post.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })), tags: post.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })), author: post.author } as Prisma.InputJsonValue;
}

export async function recordRevision(req: Request, entityType: WorkflowEntity, entityId: string, version: number, action: string, comment = '') {
  const snapshot = await snapshotForWorkflow(entityType, entityId);
  return db.contentRevision.create({ data: { entityType, entityId, version, action, snapshot, comment, actorId: req.user!.id, actorName: req.user!.name } });
}

export async function notifyWorkflow(userIds: string[], entityType: WorkflowEntity, entityId: string, message: string) {
  const unique = [...new Set(userIds)];
  if (unique.length) await db.workflowNotification.createMany({ data: unique.map((userId) => ({ userId, entityType, entityId, message })) });
}

export async function reviewersFor(reviewerId?: string | null) {
  if (reviewerId) {
    const reviewer = await db.user.findUnique({ where: { id: reviewerId }, select: { id: true, active: true, role: true } });
    if (!reviewer?.active || reviewer.role === 'AUTHOR') throw badRequest('Choose an active Editor or Super Admin as reviewer.', { reviewerId: 'Not eligible.' });
    return [reviewer.id];
  }
  const users = await db.user.findMany({ where: { active: true, role: { in: ['EDITOR', 'SUPER_ADMIN'] } }, select: { id: true } });
  return users.map((user) => user.id);
}
