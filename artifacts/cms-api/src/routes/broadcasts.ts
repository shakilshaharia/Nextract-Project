import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import { badRequest, notFound, parse } from '../lib/http.ts';
import { sendMail } from '../lib/mail.ts';
import { sendBroadcast } from '../lib/newsletter.ts';
import { plainText, sanitizeWidgetHtml } from '../lib/sanitize.ts';

export const broadcastsRouter = Router();
broadcastsRouter.use(requireCap('settings.manage'));

const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const updateSchema = z.object({
  subject: z.string().trim().max(300).default(''),
  preheader: z.string().trim().max(300).default(''),
  bodyHtml: z.string().max(100000).default(''),
  audienceTags: z.array(z.string().trim().max(40)).max(50).default([]),
});

broadcastsRouter.get('/', async (_req, res) => {
  const items = await db.broadcast.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ items: items.map((b) => ({ id: b.id, subject: b.subject, status: b.status, scheduledAt: b.scheduledAt, sentAt: b.sentAt, recipients: b.recipients, sent: b.sent, failed: b.failed, opens: b.opens, updatedAt: b.updatedAt })) });
});

broadcastsRouter.get('/:id', async (req, res) => {
  const broadcast = await db.broadcast.findUnique({ where: { id: String(req.params.id) } });
  if (!broadcast) throw notFound('Broadcast');
  res.json({ broadcast });
});

broadcastsRouter.post('/', async (req, res) => {
  const { subject } = parse(z.object({ subject: z.string().trim().min(1, 'Add a subject.').max(300) }), req.body);
  const broadcast = await db.broadcast.create({ data: { subject, bodyHtml: '', audienceTags: [], createdById: req.user?.id ?? null } });
  logActivity(req, 'create', 'broadcast', `Created broadcast “${subject}”`, broadcast.id);
  res.status(201).json({ broadcast });
});

broadcastsRouter.put('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.broadcast.findUnique({ where: { id } });
  if (!existing) throw notFound('Broadcast');
  if (existing.status === 'SENDING' || existing.status === 'SENT') throw badRequest('A sent broadcast cannot be edited.');
  const input = parse(updateSchema, req.body);
  const broadcast = await db.broadcast.update({ where: { id }, data: { ...input, bodyHtml: sanitizeWidgetHtml(input.bodyHtml) } });
  res.json({ broadcast });
});

broadcastsRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const broadcast = await db.broadcast.findUnique({ where: { id } });
  if (!broadcast) throw notFound('Broadcast');
  await db.broadcast.delete({ where: { id } });
  logActivity(req, 'delete', 'broadcast', `Deleted broadcast “${broadcast.subject}”`, broadcast.id);
  res.json({ ok: true });
});

// Send a single test email to the given address, without touching stats.
broadcastsRouter.post('/:id/test', async (req, res) => {
  const broadcast = await db.broadcast.findUnique({ where: { id: String(req.params.id) } });
  if (!broadcast) throw notFound('Broadcast');
  const { to } = parse(z.object({ to: z.string().trim().toLowerCase().email('Enter a valid email.') }), req.body);
  await sendMail({ to, subject: `[Test] ${broadcast.subject}`, text: plainText(broadcast.bodyHtml), html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto">${broadcast.bodyHtml}</div>` });
  res.json({ ok: true });
});

// Schedule (set a future send time) or clear the schedule.
broadcastsRouter.post('/:id/schedule', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.broadcast.findUnique({ where: { id } });
  if (!existing) throw notFound('Broadcast');
  if (existing.status === 'SENDING' || existing.status === 'SENT') throw badRequest('This broadcast has already been sent.');
  const { scheduledAt } = parse(z.object({ scheduledAt: z.string().max(40).nullable() }), req.body);
  const when = toDate(scheduledAt);
  const broadcast = await db.broadcast.update({ where: { id }, data: { status: when ? 'SCHEDULED' : 'DRAFT', scheduledAt: when } });
  logActivity(req, 'schedule', 'broadcast', `${when ? 'Scheduled' : 'Unscheduled'} broadcast “${broadcast.subject}”`, broadcast.id);
  res.json({ broadcast });
});

// Send now (processed in the background; the client polls status).
broadcastsRouter.post('/:id/send', async (req, res) => {
  const id = String(req.params.id);
  const broadcast = await db.broadcast.findUnique({ where: { id } });
  if (!broadcast) throw notFound('Broadcast');
  if (broadcast.status === 'SENDING' || broadcast.status === 'SENT') throw badRequest('This broadcast has already been sent.');
  if (!broadcast.subject.trim() || !broadcast.bodyHtml.trim()) throw badRequest('Add a subject and message before sending.');
  const active = await db.subscriber.count({ where: { status: 'ACTIVE' } });
  if (active === 0) throw badRequest('There are no active subscribers to send to.');
  logActivity(req, 'send', 'broadcast', `Sending broadcast “${broadcast.subject}”`, broadcast.id);
  void sendBroadcast(id).catch((e) => console.error('[newsletter] send failed:', (e as Error).message));
  res.json({ ok: true });
});
