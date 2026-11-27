import { Router } from 'express';
import { campaignConfigSchema, formFieldsSchema, resourceTypeSegment, type FormField } from '@workspace/cms-content';
import { z } from 'zod';
import { db } from '../db.ts';
import { userCan } from '../lib/auth.ts';
import { getSiteBootstrap } from '../lib/content.ts';
import { assertFormOpen, formRedirectSchema, saveCustomSubmission, saveSubmission, spamVerdict, verifyRecaptcha } from '../lib/forms.ts';
import { badRequest, notFound, parse } from '../lib/http.ts';
import { getPublicResource, getPublicResources } from '../lib/posts.ts';
import { verifyPreviewToken } from '../lib/preview.ts';
import { limiter } from '../lib/rate.ts';
import { logNotFound } from '../lib/monitor404.ts';
import { confirmSubscriber, subscribe, unsubscribeByToken } from '../lib/newsletter.ts';
import { getSetting } from '../lib/settings.ts';
import { consentRouter } from './consent.ts';
import { choicesForRequest } from '../lib/privacy.ts';

export const publicRouter = Router();
publicRouter.use('/consent', consentRouter);

// Short shared caching: content changes show up within a minute even through
// a CDN, and the browser revalidates rather than re-downloading.
function publicCache(seconds: number) {
  return `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`;
}

publicRouter.get('/bootstrap', async (req, res) => {
  const query = parse(
    z.object({
      path: z.string().max(300).default('/'),
      preview: z.enum(['0', '1']).optional(),
    }),
    req.query,
  );
  // Drafts are only ever shown to signed-in editors.
  const preview = query.preview === '1' && userCan(req, 'pages.edit');
  const bootstrap = await getSiteBootstrap(query.path, { preview });
  res.setHeader('Cache-Control', preview ? 'no-store' : publicCache(30));
  res.json(bootstrap);
});

// ---------------------------------------------------------------------------
// Resources (blogs, use cases, events)
// ---------------------------------------------------------------------------

// Routing config for the public site's edge middleware: the enabled redirects
// and the maintenance flag. Small and cacheable; the site revalidates it on a
// short interval rather than per request.
publicRouter.get('/routing', async (_req, res) => {
  const [redirects, site] = await Promise.all([
    db.redirect.findMany({ where: { enabled: true }, select: { fromPath: true, toPath: true, statusCode: true }, orderBy: { fromPath: 'asc' } }),
    getSetting('site'),
  ]);
  res.setHeader('Cache-Control', publicCache(30));
  res.json({
    maintenance: site.maintenanceMode,
    maintenanceMessage: site.maintenanceMessage,
    redirects,
  });
});

// The whole published set; the site filters, sorts and paginates in the
// browser. The list is small, so this stays one cheap, cacheable response.
publicRouter.get('/resources', async (_req, res) => {
  const items = await getPublicResources();
  res.setHeader('Cache-Control', publicCache(60));
  res.json({ items });
});

publicRouter.get('/resources/:segment/:slug', async (req, res) => {
  let preview = false;
  if (req.query.preview === '1' && userCan(req, 'posts.editOwn')) {
    const item = await db.post.findUnique({ where: { slug: String(req.params.slug) }, select: { authorId: true, type: true } });
    preview = Boolean(item && resourceTypeSegment[item.type] === String(req.params.segment) && (userCan(req, 'posts.editAll') || item.authorId === req.user!.id));
  }
  const claims = verifyPreviewToken(typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined);
  if (claims?.kind === 'post') {
    const item = await db.post.findUnique({ where: { id: claims.id }, select: { slug: true, type: true } });
    preview = Boolean(item && item.slug === String(req.params.slug) && resourceTypeSegment[item.type] === String(req.params.segment));
  }
  const resource = await getPublicResource(String(req.params.segment), String(req.params.slug), { preview });
  if (!resource) throw notFound('Resource');
  res.setHeader('Cache-Control', preview ? 'no-store' : publicCache(60));
  res.json({ resource, preview });
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const formLimiter = limiter({
  windowMinutes: 10,
  limit: 6,
  message: 'You have sent several messages in a short time. Please wait a few minutes and try again.',
});

// 404 monitor. In production the Next.js site serves public pages itself, so
// its not-found page reports the missing path here. logNotFound applies the
// on/off setting, ignores assets/junk, and caps the table size.
const notFoundLimiter = limiter({ windowMinutes: 10, limit: 60, message: 'Too many requests.' });
const metricLimiter = limiter({ windowMinutes: 1, limit: 60, message: 'Too many metric requests.' });
publicRouter.post('/not-found', notFoundLimiter, async (req, res) => {
  const { path, referrer } = parse(
    z.object({ path: z.string().trim().min(1).max(500), referrer: z.string().max(1000).default('') }),
    req.body,
  );
  await logNotFound(path, { userAgent: String(req.headers['user-agent'] ?? ''), referrer });
  res.status(204).end();
});

const email = z.string().trim().toLowerCase().max(200).email('Enter a valid email address, like name@company.com.');
const antiSpam = {
  website: z.string().max(200).optional(),
  startedAt: z.number().int().optional(),
  recaptchaToken: z.string().max(4000).optional(),
};

publicRouter.post('/forms/demo', formLimiter, async (req, res) => {
  await assertFormOpen('DEMO');
  const input = parse(
    z.object({
      name: z.string().trim().min(1, 'Enter your full name.').max(120),
      email,
      company: z.string().trim().min(1, 'Enter your company name.').max(160),
      interest: z.string().trim().max(80).default(''),
      message: z.string().trim().max(3000).default(''),
      ...antiSpam,
    }),
    req.body,
  );
  const verdict = spamVerdict(input);
  if (verdict.silent) return void res.json({ ok: true });
  await verifyRecaptcha(input.recaptchaToken, req);
  await saveSubmission(req, 'DEMO', { name: input.name, email: input.email, company: input.company, data: { interest: input.interest, message: input.message } }, verdict);
  res.status(201).json({ ok: true });
});

publicRouter.post('/forms/contact', formLimiter, async (req, res) => {
  await assertFormOpen('CONTACT');
  const input = parse(
    z.object({
      fullName: z.string().trim().min(1, 'Enter your full name.').max(120),
      email,
      company: z.string().trim().max(160).default(''),
      inquiryType: z.string().trim().min(1, 'Choose an inquiry type.').max(80),
      solution: z.string().trim().max(80).default(''),
      message: z.string().trim().min(1, 'Tell us a little about what you need.').max(5000, 'Keep the message under 5,000 characters.'),
      ...antiSpam,
    }),
    req.body,
  );
  const verdict = spamVerdict(input);
  if (verdict.silent) return void res.json({ ok: true });
  await verifyRecaptcha(input.recaptchaToken, req);
  await saveSubmission(
    req,
    'CONTACT',
    { name: input.fullName, email: input.email, company: input.company, data: { inquiryType: input.inquiryType, solution: input.solution, message: input.message } },
    verdict,
  );
  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Custom forms built in the admin Form Builder.
// ---------------------------------------------------------------------------

// Validates posted values against a form's field definitions.
function validateFormValues(fields: FormField[], body: Record<string, unknown>) {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = body[field.name];
    let value = typeof raw === 'boolean' ? (raw ? 'yes' : '') : String(raw ?? '').trim();
    if ((field.type === 'checkbox' || field.type === 'consent') && (raw === true || raw === 'on' || raw === 'true' || raw === 'yes')) value = 'yes';
    const name = field.label || field.name;
    if (field.required && !value) errors[field.name] = `${name} is required.`;
    else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) errors[field.name] = 'Enter a valid email address.';
    values[field.name] = value.slice(0, 5000);
  }
  return { values, errors };
}

function toPublicForm(form: { slug: string; name: string; description: string; fields: unknown; submitLabel: string; successMessage: string; redirectUrl: string; requireCaptcha: boolean }) {
  return {
    slug: form.slug,
    name: form.name,
    description: form.description,
    fields: formFieldsSchema.parse(form.fields),
    submitLabel: form.submitLabel,
    successMessage: form.successMessage,
    redirectUrl: formRedirectSchema.safeParse(form.redirectUrl).data ?? '',
    requireCaptcha: form.requireCaptcha,
  };
}

publicRouter.get('/forms/custom/:slug', async (req, res) => {
  const form = await db.form.findUnique({ where: { slug: String(req.params.slug) } });
  if (!form || !form.enabled) throw notFound('Form');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ form: toPublicForm(form) });
});

publicRouter.post('/forms/custom/:slug/view', metricLimiter, async (req, res) => {
  if (!(await choicesForRequest(req)).analytics) return void res.status(204).end();
  await db.form.updateMany({ where: { slug: String(req.params.slug), enabled: true }, data: { views: { increment: 1 } } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Newsletter (subscribe / confirm / unsubscribe / open tracking)
// ---------------------------------------------------------------------------

publicRouter.post('/subscribe', formLimiter, async (req, res) => {
  const settings = await getSetting('newsletter');
  if (!settings.enabled) return void res.json({ ok: true, status: 'active', message: settings.welcomeMessage });
  const input = parse(
    z.object({ email, name: z.string().trim().max(200).default(''), tags: z.array(z.string().trim().max(40)).max(20).default([]), source: z.string().trim().max(80).default('website'), ...antiSpam }),
    req.body,
  );
  const verdict = spamVerdict(input);
  if (verdict.silent) return void res.json({ ok: true, status: 'pending', message: settings.successMessage });
  await verifyRecaptcha(input.recaptchaToken, req);
  const result = await subscribe(input.email, input.name, input.tags, input.source);
  const message = result === 'active' || result === 'already' ? settings.welcomeMessage : settings.successMessage;
  res.status(201).json({ ok: true, status: result, message });
});

publicRouter.get('/newsletter/confirm', async (req, res) => {
  const tokenValue = typeof req.query.token === 'string' ? req.query.token : '';
  const subscriber = tokenValue ? await confirmSubscriber(tokenValue) : null;
  const settings = await getSetting('newsletter');
  res.setHeader('Cache-Control', 'no-store');
  res.json(subscriber ? { ok: true, message: settings.welcomeMessage } : { ok: false, message: 'This confirmation link is invalid or has already been used.' });
});

publicRouter.get('/newsletter/unsubscribe', async (req, res) => {
  const tokenValue = typeof req.query.token === 'string' ? req.query.token : '';
  const subscriber = tokenValue ? await unsubscribeByToken(tokenValue) : null;
  res.setHeader('Cache-Control', 'no-store');
  res.json(subscriber ? { ok: true, email: subscriber.email, message: 'You have been unsubscribed. We’re sorry to see you go.' } : { ok: false, message: 'This unsubscribe link is invalid.' });
});

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
publicRouter.get('/newsletter/open/:broadcastId/:subscriberId', metricLimiter, async (req, res) => {
  await db.broadcast.updateMany({ where: { id: String(req.params.broadcastId) }, data: { opens: { increment: 1 } } }).catch(() => undefined);
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(PIXEL);
});

// ---------------------------------------------------------------------------
// Campaigns (announcement bars / popups)
// ---------------------------------------------------------------------------

publicRouter.get('/campaigns', async (_req, res) => {
  const now = new Date();
  const items = await db.campaign.findMany({
    where: {
      enabled: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: items.map((c) => ({ id: c.id, type: c.type, config: campaignConfigSchema.parse(c.config) })) });
});

publicRouter.post('/campaigns/:id/event', metricLimiter, async (req, res) => {
  if (!(await choicesForRequest(req)).analytics) return void res.status(204).end();
  const { event } = parse(z.object({ event: z.enum(['view', 'click', 'dismiss']) }), req.body);
  const field = event === 'click' ? 'clicks' : event === 'dismiss' ? 'dismissals' : 'views';
  await db.campaign.updateMany({ where: { id: String(req.params.id) }, data: { [field]: { increment: 1 } } });
  res.json({ ok: true });
});

publicRouter.post('/forms/custom/:slug', formLimiter, async (req, res) => {
  const form = await db.form.findUnique({ where: { slug: String(req.params.slug) } });
  if (!form || !form.enabled) throw notFound('Form');
  const fields = formFieldsSchema.parse(form.fields);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { values, errors } = validateFormValues(fields, body);
  if (Object.keys(errors).length) throw badRequest('Please check the highlighted fields.', errors);
  const verdict = spamVerdict({ website: typeof body.website === 'string' ? body.website : undefined, startedAt: typeof body.startedAt === 'number' ? body.startedAt : undefined, message: Object.values(values).join(' ') });
  const redirectUrl = formRedirectSchema.safeParse(form.redirectUrl).data ?? '';
  if (verdict.silent) return void res.json({ ok: true, successMessage: form.successMessage, redirectUrl });
  await verifyRecaptcha(typeof body.recaptchaToken === 'string' ? body.recaptchaToken : undefined, req);
  await saveCustomSubmission(req, form, values, verdict);
  res.status(201).json({ ok: true, successMessage: form.successMessage, redirectUrl });
});
