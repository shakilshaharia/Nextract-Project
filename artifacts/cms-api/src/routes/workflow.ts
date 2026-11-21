import { Router, type Request } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { userCan } from '../lib/auth.ts';
import { badRequest, forbidden, HttpError, notFound, parse } from '../lib/http.ts';
import { notifyWorkflow, recordRevision, reviewersFor, type WorkflowEntity } from '../lib/workflow.ts';

export const workflowRouter = Router();
const entitySchema = z.enum(['page', 'post']);
const actionSchema = z.object({
  action: z.enum(['submit', 'start-review', 'approve', 'reject', 'request-revisions', 'comment', 'assign']),
  reviewerId: z.string().max(191).optional(),
  comment: z.string().trim().max(5000).default(''),
});

async function itemFor(req: Request, type: WorkflowEntity, id: string) {
  if (type === 'page') {
    if (!userCan(req, 'pages.edit') && !userCan(req, 'workflow.review')) throw forbidden();
    const item = await db.page.findUnique({ where: { id } });
    if (!item) throw notFound('Page');
    return item;
  }
  const item = await db.post.findUnique({ where: { id } });
  if (!item) throw notFound('Post');
  if (!userCan(req, 'posts.editAll') && item.authorId !== req.user!.id) throw forbidden();
  return item;
}

workflowRouter.get('/queue', async (req, res) => {
  if (!userCan(req, 'workflow.review')) throw forbidden();
  const { type, page } = parse(z.object({ type: entitySchema.default('post'), page: z.coerce.number().int().min(1).max(10000).default(1) }), req.query);
  const where = { workflowState: { in: ['SUBMITTED', 'IN_REVIEW'] as Array<'SUBMITTED' | 'IN_REVIEW'> } };
  const [items, total] = type === 'page' ? await Promise.all([
    db.page.findMany({ where, select: { id: true, title: true, workflowState: true, reviewerId: true, submittedAt: true, updatedAt: true }, orderBy: { submittedAt: 'asc' }, skip: (page - 1) * 25, take: 25 }), db.page.count({ where }),
  ]) : await Promise.all([
    db.post.findMany({ where, select: { id: true, title: true, workflowState: true, reviewerId: true, submittedAt: true, updatedAt: true, type: true, author: { select: { name: true } } }, orderBy: { submittedAt: 'asc' }, skip: (page - 1) * 25, take: 25 }), db.post.count({ where }),
  ]);
  res.json({ items: items.map((item) => ({ ...item, entityType: type })), total, page, pages: Math.max(1, Math.ceil(total / 25)) });
});

workflowRouter.get('/reviewers', async (req, res) => {
  if (!userCan(req, 'pages.edit') && !userCan(req, 'posts.editOwn')) throw forbidden();
  const items = await db.user.findMany({ where: { active: true, role: { in: ['EDITOR', 'SUPER_ADMIN'] } }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } });
  res.json({ items });
});

workflowRouter.get('/notifications', async (req, res) => {
  const page = parse(z.coerce.number().int().min(1).max(10000).default(1), req.query.page);
  const [items, unread, total] = await Promise.all([
    db.workflowNotification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25 }),
    db.workflowNotification.count({ where: { userId: req.user!.id, readAt: null } }),
    db.workflowNotification.count({ where: { userId: req.user!.id } }),
  ]);
  res.json({ items, unread, total, page, pages: Math.max(1, Math.ceil(total / 25)) });
});

workflowRouter.post('/notifications/:id/read', async (req, res) => {
  await db.workflowNotification.updateMany({ where: { id: String(req.params.id), userId: req.user!.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
});

workflowRouter.get('/:type/:id', async (req, res) => {
  const type = parse(entitySchema, req.params.type);
  const id = String(req.params.id);
  const item = await itemFor(req, type, id);
  const page = parse(z.coerce.number().int().min(1).max(10000).default(1), req.query.page);
  const [revisions, total, reviewer] = await Promise.all([
    db.contentRevision.findMany({ where: { entityType: type, entityId: id }, select: { id: true, version: true, action: true, comment: true, actorName: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25 }),
    db.contentRevision.count({ where: { entityType: type, entityId: id } }),
    item.reviewerId ? db.user.findUnique({ where: { id: item.reviewerId }, select: { id: true, name: true } }) : null,
  ]);
  res.json({ workflow: { state: item.workflowState, version: item.workflowVersion, approvedVersion: item.approvedVersion, reviewer, ownerId: item.authorId, submittedAt: item.submittedAt, reviewedAt: item.reviewedAt }, revisions, total, page, pages: Math.max(1, Math.ceil(total / 25)) });
});

workflowRouter.get('/:type/:id/revisions/:revision', async (req, res) => {
  const type = parse(entitySchema, req.params.type);
  const id = String(req.params.id);
  await itemFor(req, type, id);
  const revision = await db.contentRevision.findFirst({ where: { id: String(req.params.revision), entityType: type, entityId: id } });
  if (!revision) throw notFound('Revision');
  res.json({ revision: { id: revision.id, version: revision.version, action: revision.action, actorName: revision.actorName, createdAt: revision.createdAt, snapshot: revision.snapshot } });
});

workflowRouter.post('/:type/:id', async (req, res) => {
  const type = parse(entitySchema, req.params.type);
  const id = String(req.params.id);
  const input = parse(actionSchema, req.body);
  const item = await itemFor(req, type, id);
  const reviewer = userCan(req, 'workflow.review');
  const authorId = type === 'page' ? item.authorId : item.authorId;
  const isOwner = authorId === req.user!.id;
  const canReview = reviewer && (!item.reviewerId || item.reviewerId === req.user!.id || req.user!.role === 'SUPER_ADMIN');
  const comment = input.comment;

  if (input.action === 'comment') {
    if (!comment) throw badRequest('Write a review comment.');
    await recordRevision(req, type, id, item.workflowVersion, 'comment', comment);
    await notifyWorkflow([item.reviewerId, authorId].filter((v): v is string => Boolean(v) && v !== req.user!.id), type, id, `${req.user!.name} commented on ${item.title}`);
  } else {
    let nextState = item.workflowState;
    let reviewerId = item.reviewerId;
    let approvedVersion: number | null | undefined;
    let submittedAt: Date | undefined;
    let reviewedAt: Date | undefined;
    if (input.action === 'submit') {
      if (!['DRAFT', 'CHANGES_REQUESTED'].includes(item.workflowState)) throw badRequest('Save a draft or address requested changes before submitting.');
      if (type === 'post' && !isOwner && !userCan(req, 'posts.editAll')) throw forbidden();
      if (input.reviewerId) reviewerId = (await reviewersFor(input.reviewerId))[0];
      if (reviewerId === authorId) throw badRequest('Choose someone other than the content author as reviewer.');
      nextState = 'SUBMITTED'; submittedAt = new Date(); approvedVersion = null;
    } else if (input.action === 'assign') {
      if (!reviewer) throw forbidden();
      if (!['SUBMITTED', 'IN_REVIEW'].includes(item.workflowState)) throw badRequest('Only submitted content can be assigned.');
      if (!input.reviewerId) throw badRequest('Choose a reviewer.');
      reviewerId = (await reviewersFor(input.reviewerId))[0];
      if (reviewerId === authorId) throw badRequest('Choose someone other than the content author as reviewer.');
    } else {
      if (!canReview) throw forbidden('This review is assigned to another reviewer.');
      if (isOwner && req.user!.role !== 'SUPER_ADMIN') throw forbidden('A reviewer cannot approve or reject their own content.');
      if (input.action === 'start-review') {
        if (item.workflowState !== 'SUBMITTED') throw badRequest('This content is not submitted for review.');
        nextState = 'IN_REVIEW'; reviewerId = req.user!.id;
      } else {
        if (item.workflowState !== 'IN_REVIEW') throw badRequest('Start the review before recording a decision.');
        if (input.action === 'approve') { nextState = 'APPROVED'; approvedVersion = item.workflowVersion; }
        if (input.action === 'reject') { nextState = 'DRAFT'; approvedVersion = null; }
        if (input.action === 'request-revisions') { nextState = 'CHANGES_REQUESTED'; approvedVersion = null; }
        reviewedAt = new Date();
      }
    }
    const data = { workflowState: nextState, reviewerId, ...(approvedVersion !== undefined ? { approvedVersion } : {}), ...(submittedAt ? { submittedAt } : {}), ...(reviewedAt ? { reviewedAt } : {}) };
    const result = type === 'page'
      ? await db.page.updateMany({ where: { id, workflowVersion: item.workflowVersion, workflowState: item.workflowState }, data })
      : await db.post.updateMany({ where: { id, workflowVersion: item.workflowVersion, workflowState: item.workflowState }, data });
    if (!result.count) throw new HttpError(409, 'The content changed. Reload before reviewing.', 'conflict');
    await recordRevision(req, type, id, item.workflowVersion, input.action, comment);
    if (input.action === 'submit' || input.action === 'assign') {
      const recipients = input.action === 'assign' && reviewerId ? [reviewerId] : await reviewersFor(reviewerId);
      await notifyWorkflow(recipients.filter((userId) => userId !== req.user!.id), type, id, `${req.user!.name} ${input.action === 'assign' ? 'assigned' : 'submitted'} ${item.title} for review`);
    } else if (authorId && authorId !== req.user!.id) {
      await notifyWorkflow([authorId], type, id, `${req.user!.name} ${input.action.replace('-', ' ')} ${item.title}`);
    }
  }
  logActivity(req, input.action, type, `${req.user!.name} ${input.action.replace('-', ' ')} ${item.title}`, id);
  res.json({ ok: true });
});
