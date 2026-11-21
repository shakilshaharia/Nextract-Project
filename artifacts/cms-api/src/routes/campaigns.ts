// Admin API for promotional campaigns (announcement bars and popups).
import { campaignConfigSchema, campaignTypes } from '@workspace/cms-content';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import { notFound, parse } from '../lib/http.ts';

export const campaignsRouter = Router();
campaignsRouter.use(requireCap('settings.manage'));

const toDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Name the campaign.').max(200),
  type: z.enum(campaignTypes),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  startAt: z.string().max(40).nullable().optional(),
  endAt: z.string().max(40).nullable().optional(),
  config: campaignConfigSchema,
});

campaignsRouter.get('/', async (_req, res) => {
  const items = await db.campaign.findMany({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
  res.json({
    items: items.map((c) => ({
      id: c.id, name: c.name, type: c.type, enabled: c.enabled,
      startAt: c.startAt, endAt: c.endAt,
      views: c.views, clicks: c.clicks, dismissals: c.dismissals, updatedAt: c.updatedAt,
    })),
  });
});

campaignsRouter.get('/:id', async (req, res) => {
  const campaign = await db.campaign.findUnique({ where: { id: String(req.params.id) } });
  if (!campaign) throw notFound('Campaign');
  res.json({ campaign });
});

campaignsRouter.post('/', async (req, res) => {
  const { name, type } = parse(z.object({ name: z.string().trim().min(1, 'Name the campaign.').max(200), type: z.enum(campaignTypes).default('BAR') }), req.body);
  const campaign = await db.campaign.create({ data: { name, type, config: campaignConfigSchema.parse({}), createdById: req.user?.id ?? null } });
  logActivity(req, 'create', 'campaign', `Created campaign “${name}”`, campaign.id);
  res.status(201).json({ campaign });
});

campaignsRouter.put('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.campaign.findUnique({ where: { id } });
  if (!existing) throw notFound('Campaign');
  const input = parse(updateSchema, req.body);
  const campaign = await db.campaign.update({
    where: { id },
    data: {
      name: input.name, type: input.type, enabled: input.enabled, priority: input.priority,
      startAt: toDate(input.startAt), endAt: toDate(input.endAt), config: input.config,
    },
  });
  logActivity(req, 'update', 'campaign', `Updated campaign “${campaign.name}”`, campaign.id);
  res.json({ campaign });
});

campaignsRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) throw notFound('Campaign');
  await db.campaign.delete({ where: { id } });
  logActivity(req, 'delete', 'campaign', `Deleted campaign “${campaign.name}”`, campaign.id);
  res.json({ ok: true });
});
