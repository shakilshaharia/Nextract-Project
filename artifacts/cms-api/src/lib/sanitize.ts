// Rich text is the one place editors put markup on the public site, so it is
// sanitised on the server on every save, whatever the editor sent. Only
// formatting, links, images and video embeds from known providers survive.

import sanitizeHtml from 'sanitize-html';

const EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'];

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'label', 'input', 'span',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'img', 'figure', 'figcaption', 'div', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
    th: ['colspan', 'rowspan', 'scope', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['span'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'],
    div: ['class'],
  },
  allowedClasses: { div: ['cms-embed', 'tableWrapper'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: EMBED_HOSTS,
  transformTags: {
    a: (tagName, attribs) => {
      const next: Record<string, string> = { href: attribs.href ?? '' };
      if (attribs.target === '_blank') {
        next.target = '_blank';
        next.rel = 'noopener noreferrer';
      }
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: '' },
    }),
    // Task-list checkboxes are interactive in the editor, but published
    // article HTML is read-only. Normalize every surviving input to a disabled
    // checkbox and retain only its checked state.
    input: (tagName, attribs) => ({
      tagName,
      attribs: { type: 'checkbox', disabled: '', ...('checked' in attribs ? { checked: '' } : {}) },
    }),
  },
  // A wrapper div is only meaningful around an embed; drop empty ones.
  exclusiveFilter: (frame) => frame.tag === 'div' && !frame.text.trim() && !frame.mediaChildren.length,
};

export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, options).trim();
}

// The custom HTML widget keeps styling so pasted markup renders as designed:
// structural tags, class/id/style attributes, <style> blocks, data-/aria-
// attributes, media and https iframes. Scripts, inline event handlers and
// javascript: URLs are still removed, so it stays XSS-safe for a trusted editor.
const widgetOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'wbr',
    'span', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark', 'del', 'ins', 'abbr', 'q', 'cite', 'code', 'pre', 'kbd', 'samp', 'var', 'time', 'data',
    'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'address', 'details', 'summary', 'button', 'label',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
    'a', 'img', 'picture', 'source', 'video', 'audio', 'track', 'iframe',
    'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'defs', 'lineargradient', 'radialgradient', 'stop', 'text', 'tspan', 'title', 'desc', 'clippath', 'mask',
    'style',
  ],
  // Needed to keep <style> blocks (CSS cannot execute JS in modern browsers).
  allowVulnerableTags: true,
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title', 'role', 'dir', 'lang', 'align', 'valign', 'hidden', 'colspan', 'rowspan', 'scope', 'headers', 'span', 'start', 'reversed', 'datetime', 'aria-*', 'data-*',
      // common SVG/presentation attributes
      'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-rule', 'clip-rule', 'transform', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'offset', 'stop-color', 'stop-opacity', 'viewbox', 'preserveaspectratio', 'xmlns', 'width', 'height', 'gradientunits'],
    a: ['href', 'target', 'rel', 'download', 'name'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes', 'data-src', 'data-srcset'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload'],
    audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'frameborder', 'scrolling'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'], source: ['http', 'https', 'data'], iframe: ['https'] },
  allowProtocolRelative: true,
  // allowedIframeHostnames is intentionally omitted so any https iframe host is
  // allowed (editors embed maps, forms, players, etc.).
  transformTags: {
    // Promote common lazy-load sources so pasted markup actually shows images.
    img: (tagName, attribs) => {
      const src = attribs.src || attribs['data-src'] || attribs['data-lazy-src'] || attribs['data-original'] || '';
      return { tagName, attribs: { ...attribs, ...(src ? { src } : {}), loading: attribs.loading || 'lazy' } };
    },
  },
};

export function sanitizeWidgetHtml(html: string) {
  return sanitizeHtml(html, widgetOptions).trim();
}

export function plainText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Admin-supplied header/footer code. Super Admins only, but still checked:
// only tags that belong in a document head or before </body> are allowed,
// and inline event handlers and javascript: URLs are rejected outright.
const SCRIPT_TAGS = new Set(['script', 'noscript', 'link', 'meta', 'style', 'iframe', 'img']);

export function validateCustomCode(code: string): string | null {
  if (!code.trim()) return null;
  const tags = [...code.matchAll(/<\s*\/?\s*([a-zA-Z][\w-]*)/g)].map((match) => match[1].toLowerCase());
  const disallowed = [...new Set(tags.filter((tag) => !SCRIPT_TAGS.has(tag)))];
  if (disallowed.length) return `Only <script>, <noscript>, <link>, <meta>, <style>, <iframe> and <img> tags are allowed here (found <${disallowed.join('>, <')}>).`;
  if (/\son[a-z]+\s*=/i.test(code)) return 'Inline event handlers such as onclick= are not allowed.';
  if (/javascript\s*:/i.test(code)) return 'javascript: URLs are not allowed.';
  for (const tag of code.match(/<\s*script\b[^>]*>/gi) ?? []) {
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const url = src ? (src[1] ?? src[2] ?? src[3] ?? '').trim() : null;
    if (url !== null && !/^https:\/\//i.test(url)) return 'External scripts must load over https://.';
  }
  return null;
}
