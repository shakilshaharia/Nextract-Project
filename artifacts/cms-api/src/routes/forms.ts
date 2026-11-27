// Admin Form Builder API: create and configure custom forms. Submissions are
// handled by the public router and stored in the shared FormSubmission table.
import { formFieldsSchema, slugify } from '@workspace/cms-content';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import { formRedirectSchema } from '../lib/forms.ts';
import { badRequest, notFound, parse } from '../lib/http.ts';

export const formsRouter = Router();
formsRouter.use(requireCap('forms.manage'));

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name the form.').max(200),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().max(600).default(''),
  fields: formFieldsSchema,
  submitLabel: z.string().trim().max(80).default('Submit'),
  successMessage: z.string().trim().max(1000).default('Thanks — we’ve received your submission.'),
  redirectUrl: formRedirectSchema.default(''),
  notifyEmail: z.string().trim().max(255).default(''),
  enabled: z.boolean().default(true),
  requireCaptcha: z.boolean().default(false),
});

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'form';
  let slug = root;
  for (let n = 2; ; n++) {
    const clash = await db.form.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
    slug = `${root}-${n}`;
  }
}

formsRouter.get('/', async (_req, res) => {
  const forms = await db.form.findMany({ orderBy: { updatedAt: 'desc' }, include: { _count: { select: { submissions: true } } } });
  res.json({
    items: forms.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      enabled: f.enabled,
      fields: Array.isArray(f.fields) ? (f.fields as unknown[]).length : 0,
      submissions: f._count.submissions,
      views: f.views,
      updatedAt: f.updatedAt,
    })),
  });
});

formsRouter.get('/:id', async (req, res) => {
  const form = await db.form.findUnique({ where: { id: String(req.params.id) } });
  if (!form) throw notFound('Form');
  res.json({ form });
});

formsRouter.post('/', async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(1, 'Name the form.').max(200) }), req.body);
  const slug = await uniqueSlug(name);
  const form = await db.form.create({ data: { name, slug, fields: [], createdById: req.user?.id ?? null } });
  logActivity(req, 'create', 'form', `Created form “${name}”`, form.id);
  res.status(201).json({ form });
});

formsRouter.put('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await db.form.findUnique({ where: { id } });
  if (!existing) throw notFound('Form');
  const input = parse(formSchema, req.body);
  const fieldNames = input.fields.map((f) => f.name);
  if (new Set(fieldNames).size !== fieldNames.length) throw badRequest('Each field needs a unique name.');
  const slug = input.slug && slugify(input.slug) !== existing.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  const form = await db.form.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      description: input.description,
      fields: input.fields,
      submitLabel: input.submitLabel,
      successMessage: input.successMessage,
      redirectUrl: input.redirectUrl,
      notifyEmail: input.notifyEmail,
      enabled: input.enabled,
      requireCaptcha: input.requireCaptcha,
    },
  });
  logActivity(req, 'update', 'form', `Updated form “${form.name}”`, form.id);
  res.json({ form });
});

formsRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const form = await db.form.findUnique({ where: { id } });
  if (!form) throw notFound('Form');
  await db.form.delete({ where: { id } });
  logActivity(req, 'delete', 'form', `Deleted form “${form.name}”`, form.id);
  res.json({ ok: true });
});
