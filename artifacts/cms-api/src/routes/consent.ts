import { Router } from 'express';
import { consentChoicesSchema } from '@workspace/cms-content';
import { z } from 'zod';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { badRequest, parse } from '../lib/http.ts';
import { limiter } from '../lib/rate.ts';
import { acceptAll, CONSENT_COOKIE, countryFromRequest, currentPolicy, newVisitorId, regionFor, rejectOptional, signVisitorId, validChoices, visitorIdFromCookie } from '../lib/privacy.ts';

export const consentRouter = Router();
const consentLimiter = limiter({ windowMinutes: 10, limit: 30, message: 'Too many privacy updates. Please try again shortly.' });
const inputSchema = z.object({
  version: z.string().length(64),
  action: z.enum(['accept_all', 'reject_optional', 'customize', 'withdraw']),
  choices: consentChoicesSchema.optional(),
});

consentRouter.get('/', async (req, res) => {
  const { privacy, version } = await currentPolicy();
  const visitorId = visitorIdFromCookie(req.cookies?.[CONSENT_COOKIE]);
  const latest = visitorId ? await db.consentRecord.findFirst({ where: { visitorId }, orderBy: { createdAt: 'desc' } }) : null;
  const country = countryFromRequest(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ privacy, version, region: regionFor(country), country, consent: latest?.policyVersion === version ? {
    choices: validChoices(latest.choices), action: latest.action, recordedAt: latest.createdAt,
  } : null });
});

consentRouter.post('/', consentLimiter, async (req, res) => {
  const input = parse(inputSchema, req.body);
  const { version } = await currentPolicy();
  if (input.version !== version) throw badRequest('Privacy settings changed. Reload your preferences and choose again.');
  if (input.action === 'customize' && !input.choices) throw badRequest('Choose your cookie preferences.');
  const choices = input.action === 'accept_all' ? acceptAll : input.action === 'customize' ? input.choices! : rejectOptional;
  const visitorId = visitorIdFromCookie(req.cookies?.[CONSENT_COOKIE]) ?? newVisitorId();
  const record = await db.consentRecord.create({ data: {
    visitorId, policyVersion: version, country: countryFromRequest(req), choices, action: input.action,
  } });
  res.cookie(CONSENT_COOKIE, signVisitorId(visitorId), { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/', maxAge: 365 * 24 * 60 * 60 * 1000 });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ consent: { choices, action: input.action, recordedAt: record.createdAt } });
});
