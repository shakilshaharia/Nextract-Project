import { db } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { badRequest } from './http.ts';
import { mediaStorageKey, type Candidate, type PortableKind } from './portability.ts';

export type ConflictStrategy = 'skip' | 'rename';
export type PlannedItem = { index: number; kind: PortableKind; title: string; key: string; source: string; duplicate: boolean; proposedKey: string; warnings: string[] };
export type ImportReport = { created: number; skipped: number; failed: number; items: Array<{ index: number; kind: PortableKind; title: string; status: 'created' | 'skipped' | 'failed'; key: string; message: string }> };

const dbJson = (value: unknown) => value as Prisma.InputJsonValue;
const COLLECTIONS: Record<string, { delegate: { findMany: (args: object) => Promise<unknown[]>; create: (args: object) => Promise<unknown> }; key: string }> = {
  metric: { delegate: db.metric as never, key: 'label' }, testimonial: { delegate: db.testimonial as never, key: 'quote' }, faq: { delegate: db.faq as never, key: 'question' }, logo: { delegate: db.clientLogo as never, key: 'name' }, product: { delegate: db.product as never, key: 'anchorId' },
};

async function existingKeys() {
  const [pages, posts, categories, tags, media, menus, metrics, testimonials, faqs, logos, products] = await Promise.all([
    db.page.findMany({ select: { slug: true } }), db.post.findMany({ select: { slug: true } }), db.category.findMany({ select: { slug: true } }), db.tag.findMany({ select: { slug: true } }), db.mediaAsset.findMany({ select: { url: true } }), db.menu.findMany({ select: { location: true } }),
    db.metric.findMany({ select: { label: true } }), db.testimonial.findMany({ select: { quote: true } }), db.faq.findMany({ select: { question: true } }), db.clientLogo.findMany({ select: { name: true } }), db.product.findMany({ select: { anchorId: true } }),
  ]);
  return { page: new Set(pages.map((x) => x.slug)), post: new Set(posts.map((x) => x.slug)), category: new Set(categories.map((x) => x.slug)), tag: new Set(tags.map((x) => x.slug)), media: new Set(media.map((x) => x.url)), menu: new Set(menus.map((x) => x.location)), metric: new Set(metrics.map((x) => x.label)), testimonial: new Set(testimonials.map((x) => x.quote)), faq: new Set(faqs.map((x) => x.question)), logo: new Set(logos.map((x) => x.name)), product: new Set(products.map((x) => x.anchorId)), seo: new Set(['site']) } as Record<PortableKind, Set<string>>;
}

function conflictKey(row: Candidate) {
  const d = row.data;
  return String(row.kind === 'metric' ? d.label : row.kind === 'testimonial' ? d.quote : row.kind === 'faq' ? d.question : row.kind === 'logo' ? d.name : row.kind === 'product' ? d.anchorId : row.kind === 'seo' ? 'site' : row.key);
}

export async function planImport(candidates: Candidate[], strategy: ConflictStrategy): Promise<PlannedItem[]> {
  const used = await existingKeys();
  return candidates.map((row, index) => {
    const key = conflictKey(row);
    const duplicate = used[row.kind].has(key);
    let proposedKey = key;
    if (duplicate && strategy === 'rename' && ['page', 'post', 'category', 'tag'].includes(row.kind)) {
      let n = 2;
      const max = row.kind === 'page' ? 80 : row.kind === 'category' || row.kind === 'tag' ? 80 : 100;
      do { const suffix = `-${n++}`; proposedKey = `${key.slice(0, max - suffix.length).replace(/-+$/, '')}${suffix}`; } while (used[row.kind].has(proposedKey));
    }
    used[row.kind].add(proposedKey);
    return { index, kind: row.kind, title: row.title, key, source: row.source, duplicate, proposedKey, warnings: [...row.warnings, ...(row.kind === 'media' ? ['Media bytes are not included; verify this URL remains accessible.'] : [])] };
  });
}

const order: Record<PortableKind, number> = { category: 0, tag: 1, media: 2, metric: 3, testimonial: 3, faq: 3, logo: 3, product: 3, menu: 4, seo: 4, page: 5, post: 6 };
type MenuNode = { label: string; url: string; newTab: boolean; enabled: boolean; children: MenuNode[] };

async function applyOne(row: Candidate, proposedKey: string, actorId: string, actorName: string, includeSiteData: boolean): Promise<string> {
  const d = row.data;
  if (row.kind === 'category') {
    const item = await db.category.create({ data: { name: String(d.name), slug: proposedKey, description: String(d.description ?? '') } });
    return item.slug;
  }
  if (row.kind === 'tag') {
    const item = await db.tag.create({ data: { name: String(d.name), slug: proposedKey } });
    return item.slug;
  }
  if (row.kind === 'media') {
    const url = String(d.url);
    await db.mediaAsset.create({ data: { storageKey: mediaStorageKey(url), driver: 'external', url, filename: String(d.filename), mimeType: String(d.mimeType), kind: String(d.kind), width: d.width == null ? null : Number(d.width), height: d.height == null ? null : Number(d.height), sizeBytes: 0, variants: dbJson([]), title: String(d.title), alt: String(d.alt), caption: String(d.caption), description: String(d.description), uploadedById: actorId } });
    return url;
  }
  if (row.kind in COLLECTIONS) {
    const model = COLLECTIONS[row.kind];
    const data = { ...d };
    delete (data as Record<string, unknown>).sourceStatus;
    await model.delegate.create({ data });
    return proposedKey;
  }
  if (row.kind === 'menu') {
    if (!includeSiteData) throw badRequest('Enable site data import to apply menus.');
    const location = String(d.location);
    await db.$transaction(async (tx) => {
      const menu = await tx.menu.upsert({ where: { location }, create: { location, ctaEnabled: Boolean(d.ctaEnabled), ctaLabel: String(d.ctaLabel) }, update: { ctaEnabled: Boolean(d.ctaEnabled), ctaLabel: String(d.ctaLabel) } });
      await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
      const write = async (nodes: MenuNode[], parentId: string | null) => {
        for (const [index, node] of nodes.entries()) {
          const item = await tx.menuItem.create({ data: { menuId: menu.id, parentId, label: node.label, url: node.url, external: /^https?:\/\//.test(node.url), newTab: node.newTab, enabled: node.enabled, order: index } });
          await write(node.children ?? [], item.id);
        }
      };
      await write(d.items as MenuNode[], null);
    });
    return location;
  }
  if (row.kind === 'seo') {
    if (!includeSiteData) throw badRequest('Enable site data import to apply SEO settings.');
    await db.setting.upsert({ where: { key: 'seo' }, create: { key: 'seo', value: dbJson(d) }, update: { value: dbJson(d) } });
    return 'site';
  }
  if (row.kind === 'page') {
    return db.$transaction(async (tx) => {
      const item = await tx.page.create({ data: { title: String(d.title), slug: proposedKey, excerpt: String(d.excerpt), featuredImage: String(d.featuredImage), template: String(d.template), sections: dbJson(d.sections), seo: dbJson(d.seo), visualDraft: d.visualDraft ? dbJson(d.visualDraft) : undefined, authorId: actorId, updatedById: actorId } });
      await tx.contentRevision.create({ data: { entityType: 'page', entityId: item.id, version: 0, action: 'import', snapshot: dbJson(d), comment: '', actorId, actorName } });
      return item.slug;
    });
  }
  const categorySlugs = (d.categorySlugs as string[]).filter(Boolean);
  const tagSlugs = (d.tagSlugs as string[]).filter(Boolean);
  return db.$transaction(async (tx) => {
    for (const slug of categorySlugs) await tx.category.upsert({ where: { slug }, update: {}, create: { slug, name: slug.replaceAll('-', ' ') } });
    for (const slug of tagSlugs) await tx.tag.upsert({ where: { slug }, update: {}, create: { slug, name: slug.replaceAll('-', ' ') } });
    const item = await tx.post.create({ data: { title: String(d.title), slug: proposedKey, type: d.type as 'BLOG' | 'USE_CASE' | 'EVENT', excerpt: String(d.excerpt), featuredImage: String(d.featuredImage), featuredImageAlt: String(d.featuredImageAlt), featured: Boolean(d.featured), contentHtml: String(d.contentHtml), contentJson: dbJson(d.contentJson), readingMinutes: Math.max(1, Math.round(String(d.contentHtml).replace(/<[^>]+>/g, ' ').split(/\s+/).length / 225)), seo: dbJson(d.seo), solutions: dbJson(d.solutions), details: dbJson(d.details), faqs: dbJson(d.faqs), relatedIds: dbJson([]), authorId: actorId, categories: { connect: categorySlugs.map((slug) => ({ slug })) }, tags: { connect: tagSlugs.map((slug) => ({ slug })) } } });
    await tx.contentRevision.create({ data: { entityType: 'post', entityId: item.id, version: 0, action: 'import', snapshot: dbJson(d), comment: '', actorId, actorName } });
    return item.slug;
  });
}

export async function commitImport(candidates: Candidate[], selected: number[], strategy: ConflictStrategy, includeSiteData: boolean, actorId: string, actorName: string): Promise<ImportReport> {
  if (selected.length > 500 || selected.some((i) => !Number.isInteger(i) || i < 0 || i >= candidates.length) || new Set(selected).size !== selected.length) throw badRequest('The selected import rows are invalid.');
  const plan = await planImport(candidates, strategy);
  const chosen = new Set(selected);
  const report: ImportReport = { created: 0, skipped: 0, failed: 0, items: [] };
  const related: Array<{ slug: string; slugs: string[] }> = [];
  const importedSlugs = new Map<string, string>();
  for (const planned of [...plan].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (!chosen.has(planned.index)) continue;
    const row = candidates[planned.index];
    if ((planned.duplicate && planned.proposedKey === planned.key && !(includeSiteData && ['menu', 'seo'].includes(row.kind))) || (['menu', 'seo'].includes(row.kind) && !includeSiteData)) {
      report.skipped += 1;
      report.items.push({ index: planned.index, kind: row.kind, title: row.title, status: 'skipped', key: planned.key, message: 'Existing item or site data import disabled.' });
      continue;
    }
    try {
      const key = await applyOne(row, planned.proposedKey, actorId, actorName, includeSiteData);
      report.created += 1;
      report.items.push({ index: planned.index, kind: row.kind, title: row.title, status: 'created', key, message: row.kind === 'page' || row.kind === 'post' ? 'Imported as draft for editorial review.' : 'Imported.' });
      if (row.kind === 'post') importedSlugs.set(row.key, key);
      if (row.kind === 'post' && (row.data.relatedSlugs as string[]).length) related.push({ slug: key, slugs: row.data.relatedSlugs as string[] });
    } catch (error) {
      report.failed += 1;
      report.items.push({ index: planned.index, kind: row.kind, title: row.title, status: 'failed', key: planned.proposedKey, message: (error as Error).message });
    }
  }
  for (const row of related) {
    try {
      const target = await db.post.findUnique({ where: { slug: row.slug }, select: { id: true } });
      if (!target) continue;
      const matches = await db.post.findMany({ where: { slug: { in: row.slugs.map((slug) => importedSlugs.get(slug) ?? slug) } }, select: { id: true } });
      await db.post.update({ where: { id: target.id }, data: { relatedIds: dbJson(matches.map((post) => post.id)) } });
    } catch (error) {
      const entry = report.items.find((item) => item.kind === 'post' && item.key === row.slug);
      if (entry) entry.message += ` Related links need review: ${(error as Error).message}`;
    }
  }
  return report;
}
