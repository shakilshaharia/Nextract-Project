import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireCap } from '../lib/auth.ts';
import { parse } from '../lib/http.ts';

export const consentAdminRouter = Router();
consentAdminRouter.use(requireCap('settings.manage'));

consentAdminRouter.get('/records', async (req, res) => {
  const { page } = parse(z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }), req.query);
  const [total, rows] = await Promise.all([
    db.consentRecord.count(),
    db.consentRecord.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25 }),
  ]);
  res.json({ total, page, items: rows.map(({ id, policyVersion, country, choices, action, createdAt }) => ({ id, policyVersion, country, choices, action, createdAt })) });
});
