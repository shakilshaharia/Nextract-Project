import { Router } from 'express';
import { z } from 'zod';
import { logActivity } from '../lib/activity.ts';
import { requireCap } from '../lib/auth.ts';
import { badRequest, parse } from '../lib/http.ts';
import { commitImport, planImport } from '../lib/portability-import.ts';
import { contentExport, csvExport, markdownExport, parseImportFiles, type ImportFile } from '../lib/portability.ts';
import { boundedUpload, uploadAdmission } from '../lib/uploads.ts';

export const portabilityRouter = Router();
portabilityRouter.use(requireCap('content.portability'));
const upload = boundedUpload(20_000_000, 5_000_000).array('files', 20);
const scopeSchema = z.enum(['all', 'pages', 'posts', 'taxonomy', 'media', 'menus', 'seo', 'metrics', 'testimonials', 'faqs', 'logos', 'products']);
const strategySchema = z.enum(['skip', 'rename']).default('skip');

portabilityRouter.get('/export', async (req, res) => {
  const { format, scope } = parse(z.object({ format: z.enum(['json', 'csv', 'markdown']).default('json'), scope: scopeSchema.default('all') }), req.query);
  if (format === 'markdown' && !['pages', 'posts'].includes(scope)) throw badRequest('Markdown export supports pages or posts.');
  if (format === 'csv' && ['all', 'menus', 'seo'].includes(scope)) throw badRequest('Choose pages, posts, taxonomy, media, or a collection for CSV export.');
  const data = await contentExport();
  const date = new Date().toISOString().slice(0, 10);
  let body: string;
  let extension: string;
  let mime: string;
  if (format === 'markdown') { body = markdownExport(data, scope as 'pages' | 'posts'); extension = 'md'; mime = 'text/markdown'; }
  else if (format === 'csv') { body = csvExport(data, scope); extension = 'csv'; mime = 'text/csv'; }
  else {
    const selected = scope === 'all' ? data : {
      ...data,
      pages: scope === 'pages' ? data.pages : [], posts: scope === 'posts' ? data.posts : [],
      taxonomy: scope === 'taxonomy' ? data.taxonomy : { categories: [], tags: [] },
      collections: Object.fromEntries(Object.entries(data.collections).map(([key, value]) => [key, scope === key ? value : []])),
      menus: scope === 'menus' ? data.menus : [], media: scope === 'media' ? data.media : [], seoSettings: scope === 'seo' ? data.seoSettings : undefined,
    };
    body = JSON.stringify(selected, null, 2); extension = 'json'; mime = 'application/json';
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', `${mime}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="nextract-${scope}-${date}.${extension}"`);
  logActivity(req, 'export', 'content', `Exported ${scope} as ${format}`);
  res.send(body);
});

portabilityRouter.post('/preview', uploadAdmission, upload, async (req, res) => {
  const strategy = parse(strategySchema, req.body.strategy);
  const parsed = parseImportFiles((req.files as Express.Multer.File[] | undefined ?? []).map((file) => ({ originalname: file.originalname, buffer: file.buffer }) satisfies ImportFile));
  const items = await planImport(parsed.candidates, strategy);
  res.json({ items, errors: parsed.errors, total: items.length, note: 'Pages and resources import as drafts. Media files are references only.' });
});

portabilityRouter.post('/commit', uploadAdmission, upload, async (req, res) => {
  const strategy = parse(strategySchema, req.body.strategy);
  const includeSiteData = req.body.includeSiteData === 'true';
  let selection: unknown;
  try { selection = JSON.parse(String(req.body.selected ?? '[]')); }
  catch { throw badRequest('Invalid import selection. Preview the files again.'); }
  const selected = parse(z.array(z.number().int().min(0)).max(500), selection);
  const parsed = parseImportFiles((req.files as Express.Multer.File[] | undefined ?? []).map((file) => ({ originalname: file.originalname, buffer: file.buffer }) satisfies ImportFile));
  const report = await commitImport(parsed.candidates, selected, strategy, includeSiteData, req.user!.id, req.user!.name);
  logActivity(req, 'import', 'content', `Imported ${report.created} records; skipped ${report.skipped}, failed ${report.failed}`);
  res.json({ report, errors: parsed.errors });
});
