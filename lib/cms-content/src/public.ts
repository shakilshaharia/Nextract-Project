// The shape the public site reads. The API assembles this from the database;
// the site also bundles a copy built from the defaults, so it still renders
// when the API is unreachable.

import type {
  ClientLogo,
  DemoSettings,
  EventDetails,
  Faq,
  FormSettings,
  MenuLocation,
  Metric,
  PostFaq,
  Product,
  ResourceTypeName,
  Section,
  Seo,
  SeoSettings,
  SiteSettings,
  ThemeSettings,
  SolutionName,
  Testimonial,
  UseCaseDetails,
} from './schemas';

export type PublicMenuItem = {
  id: string;
  label: string;
  url: string;
  external: boolean;
  newTab: boolean;
  children: PublicMenuItem[];
};

export type PublicMenu = {
  location: MenuLocation;
  items: PublicMenuItem[];
  cta: { enabled: boolean; label: string };
};

export type WithId<T> = T & { id: string };

export type PublicCollections = {
  metrics: WithId<Metric>[];
  testimonials: WithId<Testimonial>[];
  faqs: WithId<Faq>[];
  logos: WithId<ClientLogo>[];
  products: WithId<Product>[];
};

export type PublicSettings = Pick<
  SiteSettings,
  | 'siteName'
  | 'logo'
  | 'footerLogo'
  | 'favicon'
  | 'contactEmail'
  | 'phone'
  | 'address'
  | 'social'
  | 'whatsapp'
  | 'copyright'
  // SEO/marketing fields the public site renders: default title/description,
  // default share image, analytics IDs, and custom head/footer scripts.
  | 'defaultSeoTitle'
  | 'defaultMetaDescription'
  | 'defaultOgImage'
  | 'googleAnalyticsId'
  | 'googleTagManagerId'
  | 'headerScripts'
  | 'footerScripts'
  | 'headerScriptsCategory'
  | 'footerScriptsCategory'
  | 'robotsDisallow'
> & {
  demo: DemoSettings;
  forms: FormSettings;
};

export type PublicPage = {
  visualLayout?: import('./visual').VisualLayout | null;
  slug: string;
  title: string;
  excerpt: string;
  featuredImage: string;
  sections: Section[];
  seo: Seo;
  updatedAt: string;
};

export type PublicPostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  featuredImage: string;
  featuredImageAlt: string;
  publishedAt: string;
  readingMinutes: number;
  author: { name: string; avatarUrl: string } | null;
  categories: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
};

export type PublicPost = PublicPostSummary & {
  html: string;
  seo: Seo;
  related: PublicPostSummary[];
};

// ---------------------------------------------------------------------------
// Resources (blogs, use cases, events) as the public site reads them.
// ---------------------------------------------------------------------------

export type ResourceCover = { src: string; alt: string } | null;

// Everything the listing and cards need; no heavy blog body.
export type PublicResourceSummary = {
  type: ResourceTypeName;
  segment: string;
  slug: string;
  path: string;
  title: string;
  summary: string;
  solutions: SolutionName[];
  tags: string[];
  featured: boolean;
  cover: ResourceCover;
  // ISO date used to order and date non-event resources.
  publishedAt: string;
  updatedAt: string;
  // Blog only.
  author: string | null;
  readingMinutes: number | null;
  // Use case only.
  useCase: UseCaseDetails | null;
  // Event only.
  event: EventDetails | null;
};

export type PublicResource = PublicResourceSummary & {
  // Blog body as sanitised HTML; empty for use cases and events.
  html: string;
  seo: Seo;
  related: PublicResourceSummary[];
  // Optional FAQ entries shown below the body on the public page.
  faqs: PostFaq[];
};

export type PublicSnippet = {
  location: 'head' | 'body_open' | 'footer';
  language: 'html' | 'css' | 'js';
  code: string;
  consentCategory: import('./schemas').ConsentCategory;
  scope: 'everywhere' | 'home' | 'resources' | 'specific';
  paths: string[];
};

export type SiteBootstrap = {
  settings: PublicSettings;
  // Global SEO configuration (titles, local/organization schema, verification,
  // social defaults, breadcrumbs) rendered site-wide by the public site.
  seo: SeoSettings;
  // Site-wide theme (fonts & colours) rendered as CSS variable overrides.
  theme: ThemeSettings;
  // Active custom code snippets (head / body / footer), injected by the site.
  snippets: PublicSnippet[];
  menus: Record<MenuLocation, PublicMenu>;
  collections: PublicCollections;
  // The page for the requested path, or null when the path is not a page
  // (the site then decides between a blog route and its own 404).
  page: PublicPage | null;
  preview: boolean;
  generatedAt: string;
};

export function formatCopyright(template: string, now = new Date()) {
  return template.replace(/\{year\}/g, String(now.getFullYear()));
}
