import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { marked } from 'marked';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import TurndownService from 'turndown';
import {
  clientLogoSchema, faqSchema, isReservedPageSlug, metricSchema, productSchema,
  sectionsSchema, seoSchema, seoSettingsSchema, slugPattern, slugify, urlSchema, solutionsSchema, postFaqsSchema,
  testimonialSchema, type Seo,
} from '@workspace/cms-content';
import { z } from 'zod';
import { db } from '../db.ts';
import { badRequest } from './http.ts';
import { parseSections, parseSeo } from './content.ts';
import { getSetting } from './settings.ts';
import { plainText, sanitizeRichText } from './sanitize.ts';
import { validateVisual } from './visual.ts';

export const portableKinds = ['page', 'post', 'category', 'tag', 'metric', 'testimonial', 'faq', 'logo', 'product', 'menu', 'media', 'seo'] as const;
export type PortableKind = typeof portableKinds[number];
export type Candidate = { kind: PortableKind; key: string; title: string; data: Record<string, unknown>; source: string; warnings: string[] };
export type ImportFile = { originalname: string; buffer: Buffer };

const titleSchema = z.string().trim().min(1).max(255);
const slugSchema = z.string().trim().toLowerCase().min(1).max(100).regex(slugPattern);
const pageSchema = z.object({ title: titleSchema, slug: slugSchema.max(80), excerpt: z.string().max(600).default(''), featuredImage: urlSchema.default(''), template: z.enum(['home', 'default', 'resources']).default('default'), sections: sectionsSchema, seo: seoSchema.default(seoSchema.parse({})), visualDraft: z.unknown().optional() });
const postSchema = z.object({ title: titleSchema, slug: slugSchema, type: z.enum(['BLOG', 'USE_CASE', 'EVENT']).default('BLOG'), excerpt: z.string().max(600).default(''), featuredImage: urlSchema.default(''), featuredImageAlt: z.string().max(300).default(''), featured: z.boolean().default(false), contentHtml: z.string().max(500_000).default(''), contentJson: z.record(z.string(), z.unknown()).default({ type: 'doc', content: [] }), seo: seoSchema.default(seoSchema.parse({})), solutions: solutionsSchema, details: z.record(z.string(), z.unknown()).default({}), faqs: postFaqsSchema, categorySlugs: z.array(slugSchema).max(20).default([]), tagSlugs: z.array(slugSchema).max(40).default([]), relatedSlugs: z.array(slugSchema).max(6).default([]) });
const termSchema = z.object({ name: z.string().trim().min(1).max(80), slug: slugSchema, description: z.string().max(400).default('') });
const mediaSchema = z.object({ url: z.string().max(2048).refine((v) => /^https?:\/\//.test(v) || /^\/(?!\/)/.test(v)), filename: z.string().max(255).default('imported-file'), mimeType: z.string().max(100).default('application/octet-stream'), kind: z.enum(['image', 'video', 'document']).default('image'), width: z.number().int().positive().max(100000).nullable().optional(), height: z.number().int().positive().max(100000).nullable().optional(), title: z.string().max(255).default(''), alt: z.string().max(500).default(''), caption: z.string().max(500).default(''), description: z.string().max(2000).default('') });
const menuLink = z.string().max(500).refine((v) => /^(?:\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(v));
const menuChild = z.object({ label: z.string().min(1).max(60), url: menuLink, newTab: z.boolean().default(false), enabled: z.boolean().default(true), children: z.array(z.never()).default([]) });
const menuNode = menuChild.extend({ children: z.array(menuChild).max(12).default([]) });
const menuSchema = z.object({ location: z.enum(['header', 'footer']), ctaEnabled: z.boolean().default(false), ctaLabel: z.string().max(40).default(''), items: z.array(menuNode).max(12) });
const collectionSchemas = { metric: metricSchema, testimonial: testimonialSchema, faq: faqSchema, logo: clientLogoSchema, product: productSchema } as const;

export function validateCandidate(candidate: Candidate): Candidate {
  const schema = candidate.kind === 'page' ? pageSchema : candidate.kind === 'post' ? postSchema
    : candidate.kind === 'category' || candidate.kind === 'tag' ? termSchema
    : candidate.kind === 'media' ? mediaSchema : candidate.kind === 'menu' ? menuSchema
    : candidate.kind === 'seo' ? seoSettingsSchema : collectionSchemas[candidate.kind];
  const result = schema.safeParse(candidate.data);
  if (!result.success) throw badRequest(`${candidate.source}: ${candidate.kind} ${candidate.title} has invalid fields: ${result.error.issues.map((i) => `${i.path.join('.') || 'item'} ${i.message}`).join('; ')}`);
  const data = result.data as Record<string, unknown>;
  if (candidate.kind in collectionSchemas) {
    const meta = z.object({ order: z.number().int().min(0).max(100000).default(0), published: z.boolean().default(false) }).safeParse(candidate.data);
    if (!meta.success) throw badRequest(`${candidate.source}: ${candidate.kind} ${candidate.title} has invalid order or published state.`);
    Object.assign(data, meta.data);
  }
  if (candidate.kind === 'page' && isReservedPageSlug(String(data.slug)) && !['home', 'contact', 'resources'].includes(String(data.slug))) throw badRequest(`${candidate.source}: reserved page slug ${data.slug}.`);
  if (candidate.kind === 'page') {
    data.sections = (data.sections as Array<Record<string, unknown>>).map((section) => section.type === 'richText' ? { ...section, html: sanitizeRichText(String(section.html ?? '')) } : section);
    if (data.visualDraft != null) data.visualDraft = validateVisual(data.visualDraft);
  }
  if (candidate.kind === 'post') data.contentHtml = sanitizeRichText(String(data.contentHtml));
  if (candidate.kind === 'product' && ['top', 'main-content', 'results', 'experiences', 'platform', 'stories', 'faq', 'footer'].includes(String(data.anchorId))) throw badRequest(`${candidate.source}: reserved product anchor ${data.anchorId}.`);
  return { ...candidate, data, key: String(data.slug ?? data.location ?? data.url ?? candidate.key), title: String(data.title ?? data.name ?? data.label ?? candidate.title) };
}

function candidate(kind: PortableKind, data: Record<string, unknown>, source: string, index: number): Candidate {
  const key = String(data.slug ?? data.location ?? data.url ?? `${kind}-${index}`);
  const title = String(data.title ?? data.name ?? data.question ?? data.role ?? data.label ?? key);
  return { kind, key, title, data, source, warnings: [] };
}

function fromJson(value: unknown, source: string): Candidate[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value as Record<string, unknown>).format !== 'nextract-content' || (value as Record<string, unknown>).version !== 1) throw badRequest(`${source}: expected a Nextract content export (version 1).`);
  const root = value as Record<string, unknown>;
  const groups: Array<[PortableKind, unknown]> = [
    ['page', root.pages], ['post', root.posts], ['category', (root.taxonomy as Record<string, unknown> | undefined)?.categories], ['tag', (root.taxonomy as Record<string, unknown> | undefined)?.tags],
    ['metric', (root.collections as Record<string, unknown> | undefined)?.metrics], ['testimonial', (root.collections as Record<string, unknown> | undefined)?.testimonials], ['faq', (root.collections as Record<string, unknown> | undefined)?.faqs], ['logo', (root.collections as Record<string, unknown> | undefined)?.logos], ['product', (root.collections as Record<string, unknown> | undefined)?.products],
    ['menu', root.menus], ['media', root.media], ['seo', root.seoSettings ? [root.seoSettings] : []],
  ];
  return groups.flatMap(([kind, items]) => Array.isArray(items) ? items.map((item, index) => candidate(kind, item as Record<string, unknown>, source, index)) : []);
}

function frontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  if (!text.startsWith('---\n')) return { meta: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) throw badRequest('Markdown front matter is missing its closing --- line.');
  const parsed = parseYaml(text.slice(4, end));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw badRequest('Markdown front matter must be a mapping.');
  return { meta: parsed as Record<string, unknown>, body: text.slice(end + 5) };
}

function fromMarkdown(text: string, source: string): Candidate[] {
  return text.split(/\n<!-- nextract-document -->\n/g).filter((part) => part.trim()).map((part, index) => {
    const { meta, body } = frontmatter(part.trimStart());
    const title = String(meta.title ?? /^#\s+(.+)$/m.exec(body)?.[1] ?? `Imported document ${index + 1}`);
    const slug = slugify(String(meta.slug ?? title));
    const html = sanitizeRichText(String(marked.parse(body, { async: false })));
    const seo = seoSchema.parse(meta.seo && typeof meta.seo === 'object' ? meta.seo : { seoTitle: meta.seoTitle ?? '', metaDescription: meta.metaDescription ?? '' });
    const kind: PortableKind = meta.kind === 'page' ? 'page' : 'post';
    return candidate(kind, kind === 'page'
      ? { title, slug, excerpt: String(meta.excerpt ?? '').slice(0, 600), featuredImage: meta.featuredImage ?? '', template: meta.template ?? 'default', sections: Array.isArray(meta.sections) ? meta.sections : [{ id: 'intro', type: 'pageIntro', visible: true, eyebrow: '', heading: title, lede: '' }, { id: 'body', type: 'richText', visible: true, html }], seo }
      : { title, slug, type: ['BLOG', 'USE_CASE', 'EVENT'].includes(String(meta.type)) ? meta.type : 'BLOG', excerpt: String(meta.excerpt ?? plainText(html)).slice(0, 600), featuredImage: meta.featuredImage ?? '', featuredImageAlt: meta.featuredImageAlt ?? '', contentHtml: html, contentJson: { type: 'doc', content: [] }, categorySlugs: Array.isArray(meta.categories) ? meta.categories : [], tagSlugs: Array.isArray(meta.tags) ? meta.tags : [], solutions: Array.isArray(meta.solutions) ? meta.solutions : [], details: meta.details && typeof meta.details === 'object' ? meta.details : {}, relatedSlugs: Array.isArray(meta.relatedSlugs) ? meta.relatedSlugs : [], faqs: meta.faqs, seo }, source, index);
  });
}

const asArray = (value: unknown): Record<string, unknown>[] => value == null ? [] : Array.isArray(value) ? value as Record<string, unknown>[] : [value as Record<string, unknown>];
const asText = (value: unknown): string => value == null ? '' : typeof value === 'object' ? String((value as Record<string, unknown>)['#text'] ?? '') : String(value);

function fromWordPress(text: string, source: string): Candidate[] {
  if (XMLValidator.validate(text) !== true) throw badRequest(`${source}: invalid WordPress XML.`);
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false }).parse(text) as Record<string, unknown>;
  const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  if (!channel) throw badRequest(`${source}: expected a WordPress WXR RSS export.`);
  const entries = asArray(channel.item);
  const attachments = new Map(entries.filter((entry) => asText(entry['wp:post_type']) === 'attachment' && asText(entry['wp:post_id']) && asText(entry['wp:attachment_url'])).map((entry) => [asText(entry['wp:post_id']), asText(entry['wp:attachment_url'])]));
  return entries.flatMap((entry, index) => {
    const wpType = asText(entry['wp:post_type']);
    if (wpType === 'attachment') {
      const url = asText(entry['wp:attachment_url']);
      return url ? [candidate('media', { url, filename: url.split('/').pop() || 'attachment', title: asText(entry.title), kind: /\.(mp4|webm)$/i.test(url) ? 'video' : 'image' }, source, index)] : [];
    }
    if (wpType !== 'post' && wpType !== 'page') return [];
    const title = asText(entry.title) || `Imported ${wpType} ${index + 1}`;
    const slug = slugify(asText(entry['wp:post_name']) || title);
    const html = sanitizeRichText(asText(entry['content:encoded']));
    const excerpt = plainText(asText(entry['excerpt:encoded']) || html).slice(0, 600);
    const meta = new Map(asArray(entry['wp:postmeta']).map((m) => [asText(m['wp:meta_key']), asText(m['wp:meta_value'])]));
    const seo = seoSchema.parse({ seoTitle: meta.get('_yoast_wpseo_title') ?? '', metaDescription: meta.get('_yoast_wpseo_metadesc') ?? '' });
    const terms = asArray(entry.category);
    const categories = terms.filter((t) => t['@_domain'] === 'category').map((t) => slugify(asText(t['@_nicename']) || asText(t)));
    const tags = terms.filter((t) => t['@_domain'] === 'post_tag').map((t) => slugify(asText(t['@_nicename']) || asText(t)));
    const thumbnailId = meta.get('_thumbnail_id');
    const featuredImage = thumbnailId ? attachments.get(thumbnailId) ?? '' : '';
    const data = wpType === 'page'
      ? { title, slug, excerpt, featuredImage, template: 'default', sections: [{ id: 'intro', type: 'pageIntro', visible: true, eyebrow: '', heading: title, lede: '' }, { id: 'body', type: 'richText', visible: true, html }], seo }
      : { title, slug, type: 'BLOG', excerpt, featuredImage, contentHtml: html, contentJson: { type: 'doc', content: [] }, categorySlugs: categories, tagSlugs: tags, seo };
    const row = candidate(wpType === 'page' ? 'page' : 'post', data, source, index);
    row.warnings.push('WordPress shortcodes and plugin-specific fields may need manual review.');
    const termRows = terms.flatMap((term, termIndex) => {
      const kind = term['@_domain'] === 'category' ? 'category' : term['@_domain'] === 'post_tag' ? 'tag' : null;
      if (!kind) return [];
      return [candidate(kind, { name: asText(term), slug: slugify(asText(term['@_nicename']) || asText(term)) }, source, index * 100 + termIndex)];
    });
    return [row, ...termRows];
  });
}

export function parseImportFiles(files: ImportFile[]): { candidates: Candidate[]; errors: string[] } {
  if (!files.length || files.length > 20) throw badRequest('Choose 1–20 JSON, Markdown, or WordPress XML files.');
  if (files.reduce((sum, file) => sum + file.buffer.length, 0) > 20_000_000) throw badRequest('The import exceeds the 20 MB total limit.');
  const candidates: Candidate[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const name = file.originalname.toLowerCase();
      const parsed = name.endsWith('.json') ? fromJson(JSON.parse(text), file.originalname)
        : name.endsWith('.md') || name.endsWith('.markdown') ? fromMarkdown(text, file.originalname)
        : name.endsWith('.xml') ? fromWordPress(text, file.originalname)
        : (() => { throw badRequest(`${file.originalname}: unsupported file type.`); })();
      for (const row of parsed) {
        try { candidates.push(validateCandidate(row)); }
        catch (error) { errors.push((error as Error).message); }
      }
    } catch (error) { errors.push((error as Error).message); }
  }
  if (candidates.length > 500) throw badRequest('Import at most 500 records per batch.');
  return { candidates, errors };
}

function menuTree(items: Array<{ id: string; parentId: string | null; label: string; url: string; newTab: boolean; enabled: boolean; order: number }>, parentId: string | null = null): unknown[] {
  return items.filter((item) => item.parentId === parentId).sort((a, b) => a.order - b.order).map((item) => ({ label: item.label, url: item.url, newTab: item.newTab, enabled: item.enabled, children: menuTree(items, item.id) }));
}

export async function contentExport() {
  const [pages, posts, categories, tags, metrics, testimonials, faqs, logos, products, menus, media, seoSettings] = await Promise.all([
    db.page.findMany({ orderBy: { createdAt: 'asc' } }), db.post.findMany({ include: { categories: true, tags: true }, orderBy: { createdAt: 'asc' } }),
    db.category.findMany(), db.tag.findMany(), db.metric.findMany(), db.testimonial.findMany(), db.faq.findMany(), db.clientLogo.findMany(), db.product.findMany(), db.menu.findMany({ include: { items: true } }), db.mediaAsset.findMany(), getSetting('seo'),
  ]);
  const postSlugs = new Map(posts.map((post) => [post.id, post.slug]));
  return {
    format: 'nextract-content', version: 1, exportedAt: new Date().toISOString(),
    pages: pages.map((p) => ({ title: p.title, slug: p.slug, excerpt: p.excerpt, featuredImage: p.featuredImage, template: p.template, sections: parseSections(p.sections), seo: parseSeo(p.seo), visualDraft: p.visualDraft, sourceStatus: p.status })),
    posts: posts.map((p) => ({ title: p.title, slug: p.slug, type: p.type, excerpt: p.excerpt, featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, featured: p.featured, contentHtml: p.contentHtml, contentJson: p.contentJson, seo: parseSeo(p.seo), solutions: p.solutions ?? [], details: p.details ?? {}, faqs: p.faqs ?? [], categorySlugs: p.categories.map((c) => c.slug), tagSlugs: p.tags.map((t) => t.slug), relatedSlugs: Array.isArray(p.relatedIds) ? p.relatedIds.map((id) => postSlugs.get(String(id))).filter(Boolean) : [], sourceStatus: p.status })),
    taxonomy: { categories: categories.map(({ name, slug, description }) => ({ name, slug, description })), tags: tags.map(({ name, slug }) => ({ name, slug })) },
    collections: { metrics: metrics.map(({ value, label, order, published }) => ({ value, label, order, published })), testimonials: testimonials.map(({ quote, role, segment, outcome, explanation, order, published }) => ({ quote, role, segment, outcome, explanation, order, published })), faqs: faqs.map(({ question, answer, order, published }) => ({ question, answer, order, published })), logos: logos.map(({ name, imageUrl, legacyMark, order, published }) => ({ name, imageUrl, legacyMark, order, published })), products: products.map(({ name, kicker, anchorId, introTitle, introBody, bridge, ctaLabel, features, order, published }) => ({ name, kicker, anchorId, introTitle, introBody, bridge, ctaLabel, features, order, published })) },
    menus: menus.map((m) => ({ location: m.location, ctaEnabled: m.ctaEnabled, ctaLabel: m.ctaLabel, items: menuTree(m.items) })),
    media: media.map(({ filename, url, mimeType, kind, width, height, title, alt, caption, description }) => ({ filename, url, mimeType, kind, width, height, title, alt, caption, description })),
    seoSettings,
  };
}

export function markdownExport(data: Awaited<ReturnType<typeof contentExport>>, scope: 'pages' | 'posts') {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  // Keep table spans and editor checkboxes in an importable HTML block.
  turndown.addRule('richTextWidgets', {
    filter: (node) => node.nodeName === 'TABLE' || (node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList'),
    replacement: (_content, node) => `\n\n${node.outerHTML}\n\n`,
  });
  const docs = scope === 'pages' ? data.pages.map((p) => ({ kind: 'page', title: p.title, slug: p.slug, excerpt: p.excerpt, featuredImage: p.featuredImage, template: p.template, sections: p.sections, seo: p.seo, body: p.sections.filter((s) => s.type === 'richText').map((s) => s.html).join('\n\n') }))
    : data.posts.map((p) => ({ kind: 'post', title: p.title, slug: p.slug, type: p.type, excerpt: p.excerpt, featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, categories: p.categorySlugs, tags: p.tagSlugs, solutions: p.solutions, details: p.details, faqs: p.faqs, relatedSlugs: p.relatedSlugs, seo: p.seo, body: p.contentHtml }));
  return docs.map(({ body, ...meta }) => `---\n${stringifyYaml(meta)}---\n\n${turndown.turndown(body)}`).join('\n<!-- nextract-document -->\n');
}

function csvCell(value: unknown) { const raw = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export function csvExport(data: Awaited<ReturnType<typeof contentExport>>, scope: string) {
  const rows = scope === 'pages' ? data.pages.map((p) => ({ slug: p.slug, title: p.title, status: p.sourceStatus, excerpt: p.excerpt, seoTitle: p.seo.seoTitle, metaDescription: p.seo.metaDescription }))
    : scope === 'posts' ? data.posts.map((p) => ({ slug: p.slug, type: p.type, title: p.title, status: p.sourceStatus, excerpt: p.excerpt, categories: p.categorySlugs.join('|'), tags: p.tagSlugs.join('|'), seoTitle: p.seo.seoTitle, metaDescription: p.seo.metaDescription }))
    : scope === 'taxonomy' ? [...data.taxonomy.categories.map((t) => ({ kind: 'category', ...t })), ...data.taxonomy.tags.map((t) => ({ kind: 'tag', ...t, description: '' }))]
    : scope === 'media' ? data.media
    : scope in data.collections ? data.collections[scope as keyof typeof data.collections]
    : [];
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  return [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell((row as Record<string, unknown>)[key])).join(','))].join('\r\n');
}

export function mediaStorageKey(url: string) { return `reference:${createHash('sha256').update(url).digest('hex')}`; }
