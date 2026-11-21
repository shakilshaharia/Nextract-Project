import type { Metadata } from 'next';
import type { NavLink } from './site';
import { siteUrl, structuredData as staticStructuredData, seo as staticSeo } from './seo';

export type CmsMenuItem = {
  id: string;
  label: string;
  url: string;
  external: boolean;
  newTab: boolean;
  children: CmsMenuItem[];
};

export type CmsSection = Record<string, unknown> & {
  id: string;
  type: string;
  visible: boolean;
};

export type CmsPageSeo = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  focusKeyword?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
  robots?: string[];
  schemaType?: string;
  schemaJson?: string;
};

// The global SEO settings the public site renders (titles, local/organization
// schema, verification codes, social defaults, breadcrumbs).
export type CmsSeoSettings = {
  titleSeparator: string;
  defaultRobots: string[];
  maxSnippet: number;
  maxImagePreview: 'none' | 'standard' | 'large';
  maxVideoPreview: number;
  orgType: 'Organization' | 'LocalBusiness' | 'Person';
  orgName: string;
  orgLogo: string;
  orgPhone: string;
  orgEmail: string;
  orgStreet: string;
  orgCity: string;
  orgRegion: string;
  orgPostalCode: string;
  orgCountry: string;
  orgLat: string;
  orgLng: string;
  orgPriceRange: string;
  twitterCard: 'summary' | 'summary_large_image';
  twitterSite: string;
  facebookAppId: string;
  googleVerify: string;
  bingVerify: string;
  yandexVerify: string;
  pinterestVerify: string;
  baiduVerify: string;
  breadcrumbsEnabled: boolean;
};

export type CmsBootstrap = {
  resources?: CmsResourceSummary[] | null;
  settings: {
    siteName: string;
    copyright: string;
    logo: { url: string; alt: string };
    footerLogo: { url: string; alt: string };
    favicon: string;
    contactEmail: string;
    phone: string;
    address: string;
    social: Record<string, string>;
    demo: {
      mode?: 'dialog' | 'url';
      url?: string;
      ctaLabel: string;
      title?: string;
      lede?: string;
      interests?: string[];
      submitLabel?: string;
      successTitle?: string;
      successMessage?: string;
    };
    defaultSeoTitle: string;
    defaultMetaDescription: string;
    defaultOgImage: string;
    googleAnalyticsId: string;
    googleTagManagerId: string;
    headerScripts: string;
    footerScripts: string;
    headerScriptsCategory?: import('@workspace/cms-content').ConsentCategory;
    footerScriptsCategory?: import('@workspace/cms-content').ConsentCategory;
    robotsDisallow: string[];
  };
  seo: CmsSeoSettings;
  theme?: { brandColor: string; textColor: string; backgroundColor: string; bodyFont: string; headingFont: string };
  snippets?: Array<{ location: 'head' | 'body_open' | 'footer'; language: 'html' | 'css' | 'js'; code: string; scope: string; paths: string[]; consentCategory?: import('@workspace/cms-content').ConsentCategory }>;
  menus: Record<string, { items: CmsMenuItem[]; cta: { enabled: boolean; label: string } }>;
  collections: {
    metrics: Array<{ id: string; value: string; label: string }>;
    testimonials: Array<{ id: string; quote: string; role: string; segment: string; outcome: string; explanation: string }>;
    faqs: Array<{ id: string; question: string; answer: string }>;
    logos: Array<{ id: string; name: string; imageUrl: string }>;
    products: Array<Record<string, unknown> & { id: string }>;
  };
  page: null | {
    visualLayout?: import('@workspace/cms-content').VisualLayout | null;
    slug: string;
    title: string;
    excerpt: string;
    sections: CmsSection[];
    seo: CmsPageSeo;
  };
};

const apiUrl = (process.env.CMS_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

export type CmsResourceSummary = {
  type: 'BLOG' | 'USE_CASE' | 'EVENT';
  path: string;
  title: string;
  summary: string;
  cover: { src: string; alt: string } | null;
  publishedAt: string;
  event: { startsAt: string; format: string } | null;
};

export type CmsResource = CmsResourceSummary & {
  slug: string;
  segment: string;
  html: string;
  author: string | null;
  readingMinutes: number | null;
  useCase: null | { industry: string; timeline: string; challenge: string; approach: string[]; benefits: string[]; verifiedOutcomes: string[] };
  event: null | { startsAt: string; endsAt?: string; timeZone: string; format: string; location: string; audience: string; learn: string[]; speakers: Array<{ name: string; role: string }> };
  faqs: Array<{ question: string; answer: string }>;
  seo: { seoTitle: string; metaDescription: string };
};

export async function getCmsBootstrap(path: string): Promise<CmsBootstrap | null> {
  try {
    const response = await fetch(`${apiUrl}/api/public/bootstrap?path=${encodeURIComponent(path)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    return (await response.json()) as CmsBootstrap;
  } catch {
    // The marketing site must remain available while the CMS is restarting or
    // unavailable. Every component keeps its checked-in content as a fallback.
    return null;
  }
}

export async function getCmsResources(): Promise<CmsResourceSummary[] | null> {
  try {
    const response = await fetch(`${apiUrl}/api/public/resources`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const payload = await response.json() as { items: CmsResourceSummary[] };
    return payload.items;
  } catch {
    return null;
  }
}

export async function getCmsResource(segment: string, slug: string, previewToken?: string): Promise<CmsResource | null> {
  try {
    const preview = previewToken ? `?previewToken=${encodeURIComponent(previewToken)}` : '';
    const response = await fetch(`${apiUrl}/api/public/resources/${encodeURIComponent(segment)}/${encodeURIComponent(slug)}${preview}`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    return ((await response.json()) as { resource: CmsResource }).resource;
  } catch {
    return null;
  }
}

export function visibleSection(bootstrap: CmsBootstrap | null, type: string) {
  return bootstrap?.page?.sections.find((section) => section.type === type && section.visible);
}

export function sectionIsVisible(bootstrap: CmsBootstrap | null, idOrKey: string, fallback = true) {
  if (!bootstrap?.page) return fallback;
  const section = bootstrap.page.sections.find((item) => item.id === idOrKey || item.key === idOrKey);
  return section ? section.visible : fallback;
}

function merge<T>(fallback: T, override: unknown): T {
  if (!override || typeof override !== 'object') return fallback;
  if (Array.isArray(fallback)) return (Array.isArray(override) ? override : fallback) as T;
  if (!fallback || typeof fallback !== 'object' || Array.isArray(override)) return override as T;
  const result = { ...(fallback as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    result[key] = key in result ? merge(result[key], value) : value;
  }
  return result as T;
}

export function managedContent<T>(bootstrap: CmsBootstrap | null, key: string, fallback: T): T {
  const section = bootstrap?.page?.sections.find((item) => item.type === 'managed' && item.key === key && item.visible);
  if (!section || typeof section.contentJson !== 'string') return fallback;
  try {
    return merge(fallback, JSON.parse(section.contentJson));
  } catch {
    return fallback;
  }
}

export function pageIntro(bootstrap: CmsBootstrap | null, fallback: { eyebrow?: string; title: string; subtitle: string }) {
  const section = visibleSection(bootstrap, 'pageIntro');
  return {
    eyebrow: typeof section?.eyebrow === 'string' ? section.eyebrow : fallback.eyebrow,
    title: typeof section?.heading === 'string' && section.heading.trim() ? section.heading : bootstrap?.page?.title || fallback.title,
    subtitle: typeof section?.lede === 'string' && section.lede.trim() ? section.lede : bootstrap?.page?.excerpt || fallback.subtitle,
  };
}

// Map stored menu items to the renderer's NavLink tree, preserving one level of
// dropdown children so the header can show nested menus.
function toNavLinks(items: CmsMenuItem[]): NavLink[] {
  return items.map((item) => ({
    label: item.label,
    href: item.url,
    newTab: item.newTab || undefined,
    children: item.children && item.children.length > 0 ? toNavLinks(item.children) : undefined,
  }));
}

// The single site-wide header menu. A second `location` argument from older
// callers is still accepted (and ignored): every caller resolves to the header.
export function cmsNav(bootstrap: CmsBootstrap | null, ...legacyLocation: [string?]): { items: NavLink[] | undefined; ctaLabel: string | undefined } {
  void legacyLocation;
  const menu = bootstrap?.menus['header'];
  return {
    items: menu ? toNavLinks(menu.items) : undefined,
    ctaLabel: menu?.cta.enabled ? menu.cta.label : bootstrap?.settings.demo.ctaLabel,
  };
}

export type CmsDemo = {
  ctaLabel?: string;
  mode?: 'dialog' | 'url';
  url?: string;
  title?: string;
  lede?: string;
  interests?: string[];
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
};

// The demo dialog / booking settings for the "Get Demo" CTA and its modal.
export function cmsDemo(bootstrap: CmsBootstrap | null): CmsDemo | undefined {
  const demo = bootstrap?.settings.demo;
  if (!demo) return undefined;
  return {
    ctaLabel: demo.ctaLabel,
    mode: demo.mode,
    url: demo.url,
    title: demo.title,
    lede: demo.lede,
    interests: demo.interests,
    submitLabel: demo.submitLabel,
    successTitle: demo.successTitle,
    successMessage: demo.successMessage,
  };
}

// Builds the site-wide theme overrides from the admin Appearance settings:
// a `:root` CSS-variable block and the Google Fonts stylesheet URL for any
// selected fonts. Colours are hex-validated and fonts are from a fixed list on
// the server, so both are safe to inject.
export function cmsTheme(bootstrap: CmsBootstrap | null): { css: string; fontHref: string } {
  const t = bootstrap?.theme;
  if (!t) return { css: '', fontHref: '' };
  const vars: string[] = [];
  if (t.brandColor) vars.push(`--color-blue:${t.brandColor};`);
  if (t.textColor) vars.push(`--color-navy:${t.textColor};`);
  if (t.backgroundColor) vars.push(`--bg-page:${t.backgroundColor};`);
  const fonts = new Set<string>();
  if (t.bodyFont && t.bodyFont !== 'Default') {
    vars.push(`--font-sans:"${t.bodyFont}",system-ui,sans-serif;`);
    fonts.add(t.bodyFont);
  }
  if (t.headingFont && t.headingFont !== 'Default') {
    vars.push(`--font-stack:"${t.headingFont}",var(--font-sans);`);
    fonts.add(t.headingFont);
  }
  const css = vars.length ? `:root{${vars.join('')}}` : '';
  const fontHref = fonts.size
    ? `https://fonts.googleapis.com/css2?${[...fonts].map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`
    : '';
  return { css, fontHref };
}

export type CmsSnippet = { location: 'head' | 'body_open' | 'footer'; language: 'html' | 'css' | 'js'; code: string; consentCategory: import('@workspace/cms-content').ConsentCategory };

const verificationMetaNames = ['google-site-verification', 'msvalidate.01', 'yandex-verification', 'p:domain_verify', 'baidu-site-verification'] as const;

function verificationValue(value: string, name: string) {
  const trimmed = value.trim();
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = trimmed.match(new RegExp(`<meta\\s+[^>]*\\bname\\s*=\\s*["']${escapedName}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i'));
  return match?.[1] ?? trimmed;
}

function verificationSnippetValue(bootstrap: CmsBootstrap | null, name: (typeof verificationMetaNames)[number]) {
  const snippet = (bootstrap?.snippets ?? []).find(
    (item) => item.location === 'head' && item.language === 'html' && item.scope === 'everywhere' && new RegExp(`<meta\\s+[^>]*\\bname\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i').test(item.code),
  );
  return snippet ? verificationValue(snippet.code, name) : '';
}

function isVerificationSnippet(snippet: NonNullable<CmsBootstrap['snippets']>[number]) {
  return snippet.location === 'head' && snippet.language === 'html' && verificationMetaNames.some((name) => new RegExp(`<meta\\s+[^>]*\\bname\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i').test(snippet.code));
}

// Active "everywhere"-scoped custom snippets for a given location. Page-scoped
// snippets (home/resources/specific) are not applied yet.
export function cmsSnippets(bootstrap: CmsBootstrap | null, location: CmsSnippet['location']): CmsSnippet[] {
  return (bootstrap?.snippets ?? [])
    // A verification meta tag needs to be server-rendered in <head>; rendering
    // it through RuntimeScripts would put it in the body after hydration.
    .filter((snippet) => snippet.scope === 'everywhere' && snippet.location === location && snippet.code && !isVerificationSnippet(snippet))
    .map((snippet) => ({ location: snippet.location, language: snippet.language, code: snippet.code, consentCategory: snippet.consentCategory ?? 'marketing' }));
}

const socialLabels: Record<string, string> = { linkedin: 'LinkedIn', x: 'X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' };

// The social profile links from Settings → Contact & social, for the footer's
// social column. Returns undefined when none are set so the footer keeps its
// built-in link.
export function cmsSocialLinks(bootstrap: CmsBootstrap | null) {
  const social = bootstrap?.settings.social ?? {};
  const links = Object.entries(social)
    .filter(([, url]) => url)
    .map(([network, url]) => ({
      label: socialLabels[network] ?? network,
      href: url as string,
      ...(network === 'linkedin' ? { icon: '/images/icons/linkedin.svg' } : {}),
    }));
  return links.length > 0 ? links : undefined;
}

// The CMS "Client logos" collection mapped for the trust strip. Returns
// undefined when empty so the strip keeps its bundled fallback set.
export function cmsLogos(bootstrap: CmsBootstrap | null) {
  const logos = (bootstrap?.collections.logos ?? []).filter((logo) => typeof logo.imageUrl === 'string' && logo.imageUrl);
  if (logos.length === 0) return undefined;
  return logos.map((logo) => ({ name: logo.name, src: logo.imageUrl }));
}

// The single site-wide footer menu, used for the footer's primary link column.
// Returns undefined when the CMS has no footer links, so the renderer keeps its
// built-in fallback list. The footer is a flat list, so children are ignored.
export function cmsFooterNav(bootstrap: CmsBootstrap | null) {
  const items = bootstrap?.menus['footer']?.items;
  if (!items || items.length === 0) return undefined;
  return items.map((item) => ({ label: item.label, href: item.url }));
}

const absoluteUrl = (value: string) => (value && !/^https?:\/\//i.test(value) ? `${siteUrl}${value.startsWith('/') ? '' : '/'}${value}` : value);
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Full per-page metadata: title, description, canonical, robots (per-page +
// site defaults), Open Graph and Twitter/X card. Relative image paths are
// resolved against metadataBase (set in the root layout).
export function cmsMetadata(bootstrap: CmsBootstrap | null, path: string, fallback: { title: string; description: string }): Metadata {
  const page = bootstrap?.page;
  const seo = page?.seo;
  const global = bootstrap?.seo;
  const title = seo?.seoTitle || page?.title || fallback.title;
  const description = seo?.metaDescription || page?.excerpt || fallback.description;
  const ogImage = seo?.ogImage || bootstrap?.settings.defaultOgImage || '';

  const directives = new Set<string>([...(global?.defaultRobots ?? []), ...(seo?.robots ?? [])]);
  const robots: Metadata['robots'] = {
    index: !seo?.noIndex,
    follow: !directives.has('nofollow'),
    nosnippet: directives.has('nosnippet'),
    noarchive: directives.has('noarchive'),
    noimageindex: directives.has('noimageindex'),
    'max-snippet': global?.maxSnippet ?? -1,
    'max-image-preview': global?.maxImagePreview ?? 'large',
    'max-video-preview': global?.maxVideoPreview ?? -1,
  };

  return {
    title,
    description,
    alternates: { canonical: seo?.canonicalUrl || path },
    robots,
    openGraph: {
      type: 'website',
      url: seo?.canonicalUrl || path,
      siteName: bootstrap?.settings.siteName || 'Nextract',
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      ...(ogImage ? { images: [{ url: absoluteUrl(ogImage) }] } : {}),
    },
    twitter: {
      card: global?.twitterCard ?? 'summary_large_image',
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      ...(global?.twitterSite ? { site: global.twitterSite } : {}),
      ...(ogImage ? { images: [absoluteUrl(ogImage)] } : {}),
    },
  };
}

// Site-wide verification + default Open Graph image for the root layout.
export function cmsSiteMetadata(bootstrap: CmsBootstrap | null): Metadata {
  const g = bootstrap?.seo;
  const other: Record<string, string> = {};
  const google = verificationValue(g?.googleVerify || verificationSnippetValue(bootstrap, 'google-site-verification'), 'google-site-verification');
  const yandex = verificationValue(g?.yandexVerify || verificationSnippetValue(bootstrap, 'yandex-verification'), 'yandex-verification');
  const bing = verificationValue(g?.bingVerify || verificationSnippetValue(bootstrap, 'msvalidate.01'), 'msvalidate.01');
  const pinterest = verificationValue(g?.pinterestVerify || verificationSnippetValue(bootstrap, 'p:domain_verify'), 'p:domain_verify');
  const baidu = verificationValue(g?.baiduVerify || verificationSnippetValue(bootstrap, 'baidu-site-verification'), 'baidu-site-verification');
  if (bing) other['msvalidate.01'] = bing;
  if (pinterest) other['p:domain_verify'] = pinterest;
  if (baidu) other['baidu-site-verification'] = baidu;
  const facebookAppId = g?.facebookAppId;
  return {
    ...(google || yandex || Object.keys(other).length
      ? { verification: { ...(google ? { google } : {}), ...(yandex ? { yandex } : {}), ...(Object.keys(other).length ? { other } : {}) } }
      : {}),
    ...(facebookAppId ? { other: { 'fb:app_id': facebookAppId } } : {}),
  };
}

// The site-wide JSON-LD graph (Organization/LocalBusiness, WebSite, and the
// software product), built from the Local SEO settings with the static values
// as a fallback when the CMS is unreachable.
export function cmsSiteJsonLd(bootstrap: CmsBootstrap | null) {
  if (!bootstrap) return staticStructuredData;
  const s = bootstrap.seo;
  const settings = bootstrap.settings;
  const org: Record<string, unknown> = {
    '@type': s.orgType || 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: s.orgName || settings.siteName || 'Nextract',
    url: siteUrl,
    description: settings.defaultMetaDescription || staticSeo.platformDescription,
  };
  if (s.orgLogo) org.logo = absoluteUrl(s.orgLogo);
  if (s.orgPhone) org.telephone = s.orgPhone;
  if (s.orgEmail) org.email = s.orgEmail;
  const sameAs = Object.values(settings.social ?? {}).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;
  if (s.orgStreet || s.orgCity || s.orgPostalCode) {
    org.address = {
      '@type': 'PostalAddress',
      ...(s.orgStreet ? { streetAddress: s.orgStreet } : {}),
      ...(s.orgCity ? { addressLocality: s.orgCity } : {}),
      ...(s.orgRegion ? { addressRegion: s.orgRegion } : {}),
      ...(s.orgPostalCode ? { postalCode: s.orgPostalCode } : {}),
      ...(s.orgCountry ? { addressCountry: s.orgCountry } : {}),
    };
  }
  if (s.orgType === 'LocalBusiness') {
    if (s.orgPriceRange) org.priceRange = s.orgPriceRange;
    if (s.orgLat && s.orgLng) org.geo = { '@type': 'GeoCoordinates', latitude: s.orgLat, longitude: s.orgLng };
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: settings.siteName || 'Nextract',
        url: siteUrl,
        description: settings.defaultMetaDescription || staticSeo.description,
        inLanguage: 'en',
        publisher: { '@id': `${siteUrl}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}/#software`,
        name: settings.siteName || 'Nextract',
        url: siteUrl,
        applicationCategory: staticSeo.category,
        operatingSystem: 'Web',
        description: staticSeo.platformDescription,
        provider: { '@id': `${siteUrl}/#organization` },
      },
    ],
  };
}

// FAQPage schema from the CMS FAQ collection, for rich results. Null when there
// are no FAQs so the caller renders nothing.
export function cmsFaqJsonLd(bootstrap: CmsBootstrap | null) {
  const faqs = bootstrap?.collections.faqs ?? [];
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(faq.answer) },
    })),
  };
}

// A page's custom JSON-LD (from the page SEO editor), parsed. Null when unset or
// invalid so a bad value never breaks the page.
export function cmsPageJsonLd(bootstrap: CmsBootstrap | null) {
  const raw = bootstrap?.page?.seo?.schemaJson;
  if (!raw || !raw.trim() || bootstrap?.page?.seo?.schemaType === 'none') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
