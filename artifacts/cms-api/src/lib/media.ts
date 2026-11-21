import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { slugify } from '@workspace/cms-content';
import sharp from 'sharp';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { db } from '../db.ts';
import type { MediaAsset, Prisma } from '../generated/prisma/client.ts';
import { badRequest } from './http.ts';
import { storage } from './storage.ts';

export type MediaKind = 'image' | 'video' | 'document';

type Detected = { mime: string; ext: string; kind: MediaKind };

const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const VARIANT_WIDTHS = [400, 800, 1200, 1600, 2000];

// Inspect central-directory names without decompressing attacker-controlled ZIPs.
// A ZIP magic byte and a renamed extension alone do not identify an Office file.
function officeEntries(buffer: Buffer): Set<string> {
  const entries = new Set<string>();
  for (let end = buffer.length - 22; end >= Math.max(0, buffer.length - 65557); end--) {
    if (buffer.readUInt32LE(end) !== 0x06054b50) continue;
    if (end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length || buffer.readUInt32LE(end + 4) !== 0) return entries;
    const count = buffer.readUInt16LE(end + 10), directorySize = buffer.readUInt32LE(end + 12);
    let offset = buffer.readUInt32LE(end + 16);
    if (count > 2048 || offset + directorySize !== end) return entries;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50 || (buffer.readUInt16LE(offset + 8) & 1)) return new Set();
      const length = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
      const next = offset + 46 + length + extra + comment;
      if (next > end) return new Set();
      const name = buffer.subarray(offset + 46, offset + 46 + length).toString('utf8');
      if (name.includes('..') || name.includes('\\') || name.startsWith('/')) return new Set();
      entries.add(name); offset = next;
    }
    return offset === end ? entries : new Set();
  }
  return entries;
}

// Identify a file from its bytes, never from the name or the browser's claim.
export function detectType(buffer: Buffer, originalName: string): Detected | null {
  const ext = path.extname(originalName).toLowerCase();
  const head = buffer.subarray(0, 64);
  const ascii = head.toString('latin1');
  const at = (offset: number, bytes: number[]) => bytes.every((byte, index) => head[offset + index] === byte);

  if (at(0, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: '.jpg', kind: 'image' };
  if (at(0, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: '.png', kind: 'image' };
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return { mime: 'image/gif', ext: '.gif', kind: 'image' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mime: 'image/webp', ext: '.webp', kind: 'image' };
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', ext: '.avif', kind: 'image' };
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return null;
    return { mime: 'video/mp4', ext: '.mp4', kind: 'video' };
  }
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', ext: '.webm', kind: 'video' };
  if (ascii.startsWith('%PDF-')) return { mime: 'application/pdf', ext: '.pdf', kind: 'document' };
  if (at(0, [0x50, 0x4b, 0x03, 0x04])) {
    const office: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    const entries = officeEntries(buffer);
    const main = { '.docx': 'word/document.xml', '.xlsx': 'xl/workbook.xml', '.pptx': 'ppt/presentation.xml' }[ext];
    return office[ext] && main && entries.has('[Content_Types].xml') && entries.has('_rels/.rels') && entries.has(main)
      ? { mime: office[ext], ext, kind: 'document' } : null;
  }

  // Text formats: no NUL bytes in the first 8 KB.
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return null;
  const text = sample.toString('utf8').trimStart();
  if ((ext === '.svg' || text.startsWith('<svg') || text.startsWith('<?xml')) && /<svg[\s>]/i.test(buffer.toString('utf8'))) {
    return { mime: 'image/svg+xml', ext: '.svg', kind: 'image' };
  }
  if (ext === '.txt') return { mime: 'text/plain', ext, kind: 'document' };
  if (ext === '.csv') return { mime: 'text/csv', ext, kind: 'document' };
  return null;
}

// SVG is XML and can carry script. Uploaded files are also served with a
// sandboxing CSP, but anything that looks active is refused at the door.
export function assertSafeSvg(buffer: Buffer) {
  const svg = buffer.toString('utf8');
  if (buffer.length > 2_000_000 || /<!DOCTYPE|<!ENTITY|<\?(?!xml\s)/i.test(svg) || XMLValidator.validate(svg) !== true) throw badRequest('That SVG is invalid or contains XML declarations that are not allowed.');
  const parsed: unknown = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, processEntities: true, ignoreDeclaration: true }).parse(svg);
  if (!parsed || typeof parsed !== 'object' || !Object.keys(parsed).some((key) => key.split(':').pop()?.toLowerCase() === 'svg')) throw badRequest('Expected an SVG root element.');
  let nodes = 0;
  const walk = (value: unknown, depth = 0) => {
    if (++nodes > 10000 || depth > 50) throw badRequest('That SVG is too complex.');
    if (Array.isArray(value)) { for (const child of value) walk(child, depth + 1); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const local = key.replace(/^@_/, '').split(':').pop()!.toLowerCase();
      if (['script', 'foreignobject', 'iframe', 'object', 'embed', 'animate', 'animatetransform', 'set'].includes(local) || (key.startsWith('@_') && local.startsWith('on'))) throw badRequest('That SVG contains active elements or event handlers.');
      if (key.startsWith('@_') && ['href', 'src'].includes(local) && !/^(?:#[\w:.-]+|data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+)$/i.test(String(child))) throw badRequest('SVG media references must be local fragments or embedded raster images.');
      if ((local === 'style' || key.startsWith('@_')) && /@import|url\(\s*(?!["']?#)|javascript\s*:/i.test(String(child))) throw badRequest('External SVG styles and URLs are not allowed.');
      walk(child, depth + 1);
    }
  };
  walk(parsed);
  const problems = [
    [/<script[\s>]/i, 'contains a <script> element'],
    [/\son[a-z]+\s*=/i, 'contains an inline event handler'],
    [/javascript\s*:/i, 'contains a javascript: URL'],
    [/<foreignObject[\s>]/i, 'contains a <foreignObject>'],
    [/<!ENTITY/i, 'declares XML entities'],
    [/(?:xlink:)?href\s*=\s*["']\s*(?:https?:|data:(?!image\/))/i, 'references external content'],
  ] as const;
  for (const [pattern, reason] of problems) {
    if (pattern.test(svg)) throw badRequest(`That SVG was rejected because it ${reason}.`);
  }
}

function svgSize(buffer: Buffer) {
  const svg = buffer.toString('utf8');
  const width = /<svg[^>]*\swidth\s*=\s*["']?([\d.]+)/i.exec(svg)?.[1];
  const height = /<svg[^>]*\sheight\s*=\s*["']?([\d.]+)/i.exec(svg)?.[1];
  if (width && height) return { width: Math.round(Number(width)), height: Math.round(Number(height)) };
  const box = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i.exec(svg);
  return box ? { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) } : { width: null, height: null };
}

export function baseKey(originalName: string) {
  const now = new Date();
  const stem = slugify(path.basename(originalName, path.extname(originalName)), 60) || 'file';
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${stem}-${randomBytes(4).toString('hex')}`;
}

export type Variant = { width: number; url: string; key: string; sizeBytes: number };

type Stored = {
  storageKey: string;
  url: string;
  mimeType: string;
  kind: MediaKind;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  variants: Variant[];
};

// Turn an upload into stored files: the original (re-encoded without EXIF for
// photos) plus responsive WebP sizes.
export async function storeUpload(buffer: Buffer, originalName: string): Promise<Stored> {
  const detected = detectType(buffer, originalName);
  if (!detected) {
    throw badRequest(
      `"${originalName}" is not a supported file. Use JPG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM, PDF, DOCX, XLSX, PPTX, TXT or CSV.`,
    );
  }
  const key = baseKey(originalName);

  if (RASTER.has(detected.mime)) {
    const image = sharp(buffer, { failOn: 'error' }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw badRequest(`"${originalName}" could not be read as an image.`);
    if (meta.width * meta.height > 60_000_000) throw badRequest('That image is over 60 megapixels; please resize it first.');

    // Re-encode the original in its own format. sharp drops EXIF (camera
    // details, GPS location) unless told to keep it.
    const encoder = sharp(buffer).rotate();
    const original =
      detected.mime === 'image/jpeg'
        ? await encoder.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
        : detected.mime === 'image/png'
          ? await encoder.png({ compressionLevel: 9 }).toBuffer()
          : detected.mime === 'image/webp'
            ? await encoder.webp({ quality: 86 }).toBuffer()
            : await encoder.avif({ quality: 60 }).toBuffer();
    const storageKey = `${key}${detected.ext}`;
    const url = await storage.put(storageKey, original, detected.mime);

    // EXIF orientations 5-8 are rotated a quarter turn, so width and height swap.
    const quarterTurn = (meta.orientation ?? 1) >= 5;
    const orientedWidth = quarterTurn ? meta.height : meta.width;
    const orientedHeight = quarterTurn ? meta.width : meta.height;
    const variants: Variant[] = [];
    for (const width of VARIANT_WIDTHS.filter((w) => w < orientedWidth)) {
      const data = await sharp(buffer).rotate().resize({ width }).webp({ quality: 80 }).toBuffer();
      const variantKey = `${key}-${width}w.webp`;
      variants.push({ width, key: variantKey, url: await storage.put(variantKey, data, 'image/webp'), sizeBytes: data.length });
    }
    return {
      storageKey,
      url,
      mimeType: detected.mime,
      kind: 'image',
      sizeBytes: original.length,
      width: orientedWidth,
      height: orientedHeight,
      variants,
    };
  }

  if (detected.mime === 'image/svg+xml') assertSafeSvg(buffer);

  let width: number | null = null;
  let height: number | null = null;
  if (detected.mime === 'image/gif') {
    const meta = await sharp(buffer, { animated: true }).metadata().catch(() => null);
    width = meta?.width ?? null;
    height = meta?.pageHeight ?? meta?.height ?? null;
  } else if (detected.mime === 'image/svg+xml') {
    ({ width, height } = svgSize(buffer));
  }

  const storageKey = `${key}${detected.ext}`;
  const url = await storage.put(storageKey, buffer, detected.mime);
  return { storageKey, url, mimeType: detected.mime, kind: detected.kind, sizeBytes: buffer.length, width, height, variants: [] };
}

export async function removeStoredFiles(asset: Pick<MediaAsset, 'driver' | 'storageKey' | 'variants'>) {
  // Static assets ship with the site build and are only unregistered.
  if (asset.driver !== storage.driver) return;
  await storage.remove(asset.storageKey);
  for (const variant of (asset.variants as Variant[] | null) ?? []) {
    await storage.remove(variant.key).catch(() => undefined);
  }
}

export function urlsOf(asset: Pick<MediaAsset, 'url' | 'variants'>) {
  return [asset.url, ...(((asset.variants as Variant[] | null) ?? []).map((variant) => variant.url))];
}

// ---------------------------------------------------------------------------
// Where is a file used? Pages, posts, settings, collections and avatars all
// store URLs, so a text search over their content finds every reference.
// ---------------------------------------------------------------------------

export type Usage = { type: string; id: string; label: string; href: string };

const contains = (haystack: unknown, urls: string[]) => {
  if (haystack == null) return false;
  const text = typeof haystack === 'string' ? haystack : JSON.stringify(haystack);
  return urls.some((url) => text.includes(url));
};

export async function findUsage(urls: string[]): Promise<Usage[]> {
  const usages: Usage[] = [];
  const [pages, posts, settings, logos, products, users] = await Promise.all([
    db.page.findMany({ select: { id: true, title: true, featuredImage: true, sections: true, published: true, seo: true, visualDraft:true, visualRevisions:{select:{layout:true}} } }),
    db.post.findMany({ select: { id: true, title: true, featuredImage: true, contentHtml: true, seo: true } }),
    db.setting.findMany(),
    db.clientLogo.findMany({ select: { id: true, name: true, imageUrl: true } }),
    db.product.findMany({ select: { id: true, name: true, features: true } }),
    db.user.findMany({ select: { id: true, name: true, avatarUrl: true } }),
  ]);
  for (const page of pages) {
    if (contains([page.featuredImage, page.sections, page.published, page.seo,page.visualDraft,page.visualRevisions], urls)) {
      usages.push({ type: 'Page', id: page.id, label: page.title, href: `/pages/${page.id}` });
    }
  }
  for (const post of posts) {
    if (contains([post.featuredImage, post.contentHtml, post.seo], urls)) {
      usages.push({ type: 'Post', id: post.id, label: post.title, href: `/posts/${post.id}` });
    }
  }
  for (const setting of settings) {
    if (contains(setting.value, urls)) usages.push({ type: 'Settings', id: setting.key, label: `${setting.key} settings`, href: '/settings' });
  }
  for (const logo of logos) {
    if (contains(logo.imageUrl, urls)) usages.push({ type: 'Client logo', id: logo.id, label: logo.name, href: '/collections/logos' });
  }
  for (const product of products) {
    if (contains(product.features, urls)) usages.push({ type: 'Product', id: product.id, label: product.name, href: '/collections/products' });
  }
  for (const user of users) {
    if (contains(user.avatarUrl, urls)) usages.push({ type: 'Avatar', id: user.id, label: user.name, href: '/users' });
  }
  return usages;
}

// Point every reference at a new URL - used by "Replace file".
export async function replaceReferences(from: string, to: string) {
  if (!from || from === to) return 0;
  const swap = <T>(value: T): T => JSON.parse(JSON.stringify(value).split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1)));
  const json = (value: unknown) => value as Prisma.InputJsonValue;
  let changed = 0;

  for (const page of await db.page.findMany()) {
    if (!contains([page.featuredImage, page.sections, page.published, page.seo,page.visualDraft], [from])) continue;
    await db.page.update({
      where: { id: page.id },
      data: {
        featuredImage: page.featuredImage === from ? to : page.featuredImage,
        sections: json(swap(page.sections)),
        seo: json(swap(page.seo)),
        ...(page.published ? { published: json(swap(page.published)) } : {}),
        ...(page.visualDraft?{visualDraft:json(swap(page.visualDraft)),visualVersion:{increment:1}}:{}),
      },
    });
    changed += 1;
  }
  // Global file replacement also keeps restorable layouts pointing at media
  // that still exists after the old file bytes are retired.
  for(const revision of await db.pageVisualRevision.findMany()){
    if(contains(revision.layout,[from]))await db.pageVisualRevision.update({where:{id:revision.id},data:{layout:json(swap(revision.layout))}});
  }
  for (const post of await db.post.findMany()) {
    if (!contains([post.featuredImage, post.contentHtml, post.contentJson, post.seo], [from])) continue;
    await db.post.update({
      where: { id: post.id },
      data: {
        featuredImage: post.featuredImage === from ? to : post.featuredImage,
        contentHtml: post.contentHtml.split(from).join(to),
        contentJson: json(swap(post.contentJson)),
        seo: json(swap(post.seo)),
      },
    });
    changed += 1;
  }
  for (const setting of await db.setting.findMany()) {
    if (!contains(setting.value, [from])) continue;
    await db.setting.update({ where: { key: setting.key }, data: { value: json(swap(setting.value)) } });
    changed += 1;
  }
  changed += (await db.clientLogo.updateMany({ where: { imageUrl: from }, data: { imageUrl: to } })).count;
  for (const product of await db.product.findMany()) {
    if (!contains(product.features, [from])) continue;
    await db.product.update({ where: { id: product.id }, data: { features: json(swap(product.features)) } });
    changed += 1;
  }
  changed += (await db.user.updateMany({ where: { avatarUrl: from }, data: { avatarUrl: to } })).count;
  return changed;
}
