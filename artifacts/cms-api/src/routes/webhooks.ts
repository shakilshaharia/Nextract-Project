// Admin API for outbound webhooks / integrations.
import { randomUUID } from 'node:crypto';
import { webhookEvents, webhookFormats } from '@workspace/cms-content';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import { badRequest, notFound, parse } from '../lib/http.ts';
import { assertPublicUrl, deliverWebhook, newSecret } from '../lib/webhooks.ts';

export const webhooksRouter = Router();
webhooksRouter.use(requireCap('settings.manage'));

// Validate the destination URL with the same SSRF guard used at send time.
async function checkUrl(url: string) {
  try {
    await assertPublicUrl(url);
  } catch (cause) {
    throw badRequest(cause instanceof Error ? cause.message : 'That URL is not allowed.', { url: cause instanceof Error ? cause.message : 'Invalid URL.' });
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Name the webhook.').max(200),
  url: z.string().trim().min(1, 'Add a destination URL.').max(2048),
  format: z.enum(webhookFormats).default('JSON'),
  events: z.array(z.enum(webhookEvents)).max(webhookEvents.length).default([]),
  enabled: z.boolean().default(true),
});

const publicShape = (w: { id: string; name: string; url: string; format: string; events: unknown; enabled: boolean; createdAt: Date; updatedAt: Date }) => ({
  id: w.id, name: w.name, url: w.url, format: w.format, events: (w.events as string[]) ?? [], enabled: w.enabled, createdAt: w.createdAt, updatedAt: w.updatedAt,
});

webhooksRouter.get('/', async (_req, res) => {
  const items = await db.webhook.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ items: items.map(publicShape) });
});

webhooksRouter.get('/:id', async (req, res) => {
  const webhook = await db.webhook.findUnique({ where: { id: String(req.params.id) } });
  if (!webhook) throw notFound('Webhook');
  // The signing secret is shown to the authenticated admin so they can verify
  // signatures on their own receiver; it is never sent to the public site.
  res.json({ webhook: { ...publicShape(webhook), secret: webhook.secret } });
});

webhooksRouter.post('/', async (req, res) => {
  const input = parse(updateSchema.partial({ events: true, enabled: true, format: true }), req.body);
  await checkUrl(input.url);
  const webhook = await db.webhook.create({
    data: { name: input.name, url: input.url, format: input.format ?? 'JSON', events: input.events ?? [], enabled: input.enabled ?? true, secret: newSecret(), createdById: req.user?.id ?? null },
  });
  logActivity(req, 'create', 'webhook', `Created webhook “${webhook.name}”`, webhook.id);
  res.status(201).json({ webhook: { ...publicShape(webhook), secret: webhook.secret } });
});

webhooksRouter.put('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.webhook.findUnique({ where: { id } });
  if (!existing) throw notFound('Webhook');
  const input = parse(updateSchema, req.body);
  await checkUrl(input.url);
  const webhook = await db.webhook.update({ where: { id }, data: { name: input.name, url: input.url, format: input.format, events: input.events, enabled: input.enabled } });
  logActivity(req, 'update', 'webhook', `Updated webhook “${webhook.name}”`, webhook.id);
  res.json({ webhook: { ...publicShape(webhook), secret: webhook.secret } });
});

webhooksRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const webhook = await db.webhook.findUnique({ where: { id } });
  if (!webhook) throw notFound('Webhook');
  await db.webhook.delete({ where: { id } });
  logActivity(req, 'delete', 'webhook', `Deleted webhook “${webhook.name}”`, webhook.id);
  res.json({ ok: true });
});

webhooksRouter.post('/:id/regenerate-secret', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.webhook.findUnique({ where: { id } });
  if (!existing) throw notFound('Webhook');
  const webhook = await db.webhook.update({ where: { id }, data: { secret: newSecret() } });
  logActivity(req, 'update', 'webhook', `Regenerated secret for webhook “${webhook.name}”`, webhook.id);
  res.json({ secret: webhook.secret });
});

// Send a sample delivery now and report the result.
webhooksRouter.post('/:id/test', async (req, res) => {
  const id = String(req.params.id);
  const webhook = await db.webhook.findUnique({ where: { id } });
  if (!webhook) throw notFound('Webhook');
  if (!webhook.enabled) throw badRequest('Enable this webhook before sending a test.');
  const payload = { event: 'test.ping', id: randomUUID(), createdAt: new Date().toISOString(), data: { message: 'This is a test delivery from your Nextract CMS.', formName: 'Test', email: 'test@example.com', subject: 'Test broadcast', title: 'Test page' } };
  const delivery = await db.webhookDelivery.create({ data: { webhookId: id, event: 'test.ping', payload, response: '', status: 'PENDING', nextAttempt: new Date() } });
  await deliverWebhook(delivery.id);
  const result = await db.webhookDelivery.findUnique({ where: { id: delivery.id } });
  res.json({ ok: result?.status === 'SUCCESS', status: result?.status, statusCode: result?.statusCode ?? null, error: result?.error ?? '' });
});

webhooksRouter.get('/:id/deliveries', async (req, res) => {
  const id = String(req.params.id);
  const webhook = await db.webhook.findUnique({ where: { id } });
  if (!webhook) throw notFound('Webhook');
  const items = await db.webhookDelivery.findMany({ where: { webhookId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({
    items: items.map((d) => ({ id: d.id, event: d.event, status: d.status, statusCode: d.statusCode, attempts: d.attempts, error: d.error, response: d.response.slice(0, 500), nextAttempt: d.nextAttempt, createdAt: d.createdAt, deliveredAt: d.deliveredAt })),
  });
});
