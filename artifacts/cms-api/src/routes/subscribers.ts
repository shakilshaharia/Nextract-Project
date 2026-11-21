import { randomUUID } from 'node:crypto';
import { subscriberStatuses } from '@workspace/cms-content';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import type { Prisma, SubscriberStatus } from '../generated/prisma/client.ts';
import { logActivity } from '../lib/activity.ts';
import { csvCell } from '../lib/csv.ts';
import { requireCap } from '../lib/auth.ts';
import { notFound, parse } from '../lib/http.ts';

export const subscribersRouter = Router();
subscribersRouter.use(requireCap('settings.manage'));

const token = () => (randomUUID() + randomUUID()).replace(/-/g, '');
const PAGE_SIZE = 50;
const emailField = z.string().trim().toLowerCase().max(255).email('Enter a valid email address.');
const tagsField = z.array(z.string().trim().max(40)).max(50).default([]);
const publicSubscriber = (s: { id: string; email: string; name: string; status: string; tags: unknown; source: string; createdAt: Date }) => ({ id: s.id, email: s.email, name: s.name, status: s.status, tags: s.tags, source: s.source, createdAt: s.createdAt });

subscribersRouter.get('/stats', async (_req, res) => {
  const grouped = await db.subscriber.groupBy({ by: ['status'], _count: true });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  res.json({ active: counts.ACTIVE ?? 0, pending: counts.PENDING ?? 0, unsubscribed: counts.UNSUBSCRIBED ?? 0, total: Object.values(counts).reduce((a, b) => a + (b as number), 0) });
});

subscribersRouter.get('/', async (req, res) => {
  const query = parse(z.object({ page: z.coerce.number().int().min(1).default(1), status: z.string().optional(), q: z.string().max(200).optional() }), req.query);
  const where: Prisma.SubscriberWhereInput = {
    ...(query.status && subscriberStatuses.includes(query.status as (typeof subscriberStatuses)[number]) ? { status: query.status as SubscriberStatus } : {}),
    ...(query.q ? { OR: [{ email: { contains: query.q } }, { name: { contains: query.q } }] } : {}),
  };
  const [total, items] = await Promise.all([
    db.subscriber.count({ where }),
    db.subscriber.findMany({ where, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE, skip: (query.page - 1) * PAGE_SIZE }),
  ]);
  res.json({
    items: items.map((s) => ({ id: s.id, email: s.email, name: s.name, status: s.status, tags: s.tags, source: s.source, createdAt: s.createdAt })),
    page: query.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total,
  });
});

subscribersRouter.post('/', async (req, res) => {
  const input = parse(z.object({ email: emailField, name: z.string().trim().max(200).default(''), tags: tagsField, status: z.enum(subscriberStatuses).default('ACTIVE') }), req.body);
  const subscriber = await db.subscriber.upsert({
    where: { email: input.email },
    update: { name: input.name, tags: input.tags, status: input.status, ...(input.status === 'ACTIVE' ? { confirmedAt: new Date(), confirmToken: null } : {}) },
    create: { email: input.email, name: input.name, tags: input.tags, status: input.status, source: 'admin', unsubscribeToken: token(), ...(input.status === 'ACTIVE' ? { confirmedAt: new Date() } : {}) },
  });
  logActivity(req, 'create', 'subscriber', `Added subscriber ${subscriber.email}`, subscriber.id);
  res.status(201).json({ subscriber: publicSubscriber(subscriber) });
});

subscribersRouter.put('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.subscriber.findUnique({ where: { id } });
  if (!existing) throw notFound('Subscriber');
  const input = parse(z.object({ name: z.string().trim().max(200).default(''), tags: tagsField, status: z.enum(subscriberStatuses) }), req.body);
  const subscriber = await db.subscriber.update({
    where: { id },
    data: { name: input.name, tags: input.tags, status: input.status, ...(input.status === 'UNSUBSCRIBED' ? { unsubscribedAt: new Date() } : {}), ...(input.status === 'ACTIVE' && existing.status !== 'ACTIVE' ? { confirmedAt: new Date(), confirmToken: null } : {}) },
  });
  res.json({ subscriber: publicSubscriber(subscriber) });
});

subscribersRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const subscriber = await db.subscriber.findUnique({ where: { id } });
  if (!subscriber) throw notFound('Subscriber');
  await db.subscriber.delete({ where: { id } });
  logActivity(req, 'delete', 'subscriber', `Removed subscriber ${subscriber.email}`, subscriber.id);
  res.json({ ok: true });
});

subscribersRouter.post('/import', async (req, res) => {
  const input = parse(z.object({ rows: z.array(z.object({ email: z.string().trim().toLowerCase().max(255), name: z.string().trim().max(200).optional() })).max(5000), tags: tagsField }), req.body);
  let added = 0;
  let skipped = 0;
  for (const row of input.rows) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) { skipped++; continue; }
    try {
      await db.subscriber.upsert({
        where: { email: row.email },
        update: { ...(row.name ? { name: row.name } : {}), ...(input.tags.length ? { tags: input.tags } : {}) },
        create: { email: row.email, name: row.name ?? '', status: 'ACTIVE', confirmedAt: new Date(), tags: input.tags, source: 'import', unsubscribeToken: token() },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  logActivity(req, 'import', 'subscriber', `Imported ${added} subscribers`);
  res.json({ added, skipped });
});

subscribersRouter.get('/export', async (req, res) => {
  const subscribers = await db.subscriber.findMany({ orderBy: { createdAt: 'desc' }, take: 10_000 });
  const esc = csvCell;
  const header = 'email,name,status,tags,source,createdAt';
  const rows = subscribers.map((s) => [s.email, s.name, s.status, (Array.isArray(s.tags) ? (s.tags as string[]).join('|') : ''), s.source, s.createdAt.toISOString()].map((v) => esc(String(v))).join(','));
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="subscribers-${stamp}.csv"`);
  res.send([header, ...rows].join('\n'));
  logActivity(req, 'export', 'subscriber', `Exported ${subscribers.length} subscribers`);
});
