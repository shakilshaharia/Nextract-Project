// Today's live content, exactly as the site renders it. The database is seeded
// from this, and the site falls back to it if the API cannot be reached, so
// the page never goes blank because of a backend problem.

import type {
  DemoSettings,
  EmailSettings,
  FormSettings,
  MenuLocation,
  Section,
  SecuritySettings,
  Seo,
  SeoSettings,
  SiteSettings,
} from './schemas';
import { newsletterSettingsSchema, privacySettingsSchema, securitySettingsSchema, seoSettingsSchema, themeSettingsSchema, type NewsletterSettings, type PrivacySettings, type ThemeSettings } from './schemas';
import type { PublicCollections, PublicMenu, PublicPage, PublicSettings, SiteBootstrap } from './public';

const emptySeo: Seo = {
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  focusKeyword: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  noIndex: false,
  robots: [],
  schemaType: 'auto',
  score: 0,
  schemaJson: '',
};

// Every field has a schema default, so an empty object yields the defaults.
export const defaultSeoSettings: SeoSettings = seoSettingsSchema.parse({});
export const defaultSecuritySettings: SecuritySettings = securitySettingsSchema.parse({});
export const defaultThemeSettings: ThemeSettings = themeSettingsSchema.parse({});
export const defaultNewsletterSettings: NewsletterSettings = newsletterSettingsSchema.parse({});
export const defaultPrivacySettings: PrivacySettings = privacySettingsSchema.parse({});

const homeSeoTitle = 'Nextract | AI-Powered Document Processing and Automation';
const homeMetaDescription = 'Nextract turns invoices, purchase orders, contracts, work orders, and other business documents into structured, validated, actionable data.';
const homeSeoSchema = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Nextract',
    url: 'https://nextract.ca/',
    description: homeMetaDescription,
    keywords: 'AI shopping assistant, AI shopping assistant for ecommerce, AI personal shopper, conversational commerce AI, AI product recommendations, ecommerce personalization, AI customer service agent, AI customer support agent, in-store AI, assisted selling, cart recovery, ecommerce upselling',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nextract',
    url: 'https://nextract.ca/',
    applicationCategory: 'Document Processing Software',
    operatingSystem: 'Web',
    description: homeMetaDescription,
    hasPart: [
      {
        '@type': 'SoftwareApplication',
        name: 'Document Processing',
        applicationCategory: 'Intelligent document processing',
        description: 'Capture and extract structured data from invoices, purchase orders, contracts, work orders, and other business documents.',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Invoice Automation',
        applicationCategory: 'Accounts payable automation',
        description: 'Validate invoice data, route exceptions, and publish approved information into connected systems.',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Document Matching',
        applicationCategory: 'Document reconciliation',
        description: 'Compare related records with two-way and three-way matching and focus people on discrepancies.',
      },
    ],
  },
]);

const video = (_name: string, poster: string) => ({
  // Feature-specific videos are optional. Until approved footage is uploaded,
  // the real workflow illustration is shown instead of requesting fake files.
  mp4: '',
  webm: '',
  poster,
});

export const defaultCollections: PublicCollections = {
  metrics: [
    { id: 'metric-speed', value: '90%', label: 'Faster processing' },
    { id: 'metric-volume', value: '23×', label: 'More invoices processed' },
    { id: 'metric-operations', value: '70%', label: 'Higher operational efficiency' },
    { id: 'metric-hours', value: '10k+ hrs', label: 'Manual work eliminated' },
    { id: 'metric-errors', value: '60%+', label: 'Fewer errors' },
  ],
  testimonials: [
    {
      id: 'story-ecommerce',
      quote: 'Most documents were routine, but our team still had to touch them. The opportunity was letting straightforward work move while people focused on exceptions.',
      role: '1,000–5,000 employees',
      segment: 'Retail & Distribution',
      outcome: '66% of routine work moved automatically',
      explanation: 'Nextract helped reduce repetitive processing and direct human attention toward the documents that required review.',
    },
    {
      id: 'story-store-ops',
      quote: 'Our team was spending too much time reconciling invoices and checking information across documents. We needed the process to move faster without losing control.',
      role: '500–1,000 employees',
      segment: 'Multi-Location Retail',
      outcome: '61% faster reconciliation',
      explanation: 'Nextract reduced manual document work by extracting, validating, and matching information before it reached review.',
    },
  ],
  faqs: [
    { id: 'faq-what', question: 'What is Nextract?', answer: 'Nextract is an AI-powered document processing platform that turns business documents into structured, validated data.' },
    { id: 'faq-documents', question: 'What types of documents can Nextract process?', answer: 'Nextract works with invoices, purchase orders, goods receipt notes, contracts, work orders, shipment records, and other business documents.' },
    { id: 'faq-match', question: 'Can Nextract compare invoices and purchase orders?', answer: 'Yes. Nextract supports two-way and three-way matching and surfaces differences in quantities, prices, vendors, and totals.' },
    { id: 'faq-exceptions', question: 'What happens when Nextract finds an exception?', answer: 'The document is routed for review with the original record and extracted values available so a person can resolve it quickly.' },
    { id: 'faq-integrations', question: 'Does Nextract replace my ERP or CRM?', answer: 'No. Nextract complements the systems you already use and publishes clean, validated data into them.' },
    { id: 'faq-review', question: 'Can users review uncertain information?', answer: 'Yes. Low-confidence values and discrepancies can be reviewed and corrected with full document context.' },
  ],
  logos: [
    { id: 'logo-canadian-tire', name: 'Canadian Tire', imageUrl: '/images/clients-grayscale/canadian-tire.png', legacyMark: null },
    { id: 'logo-lakeshore', name: 'Lakeshore', imageUrl: '/images/clients-grayscale/lakeshore.png', legacyMark: null },
    { id: 'logo-charger-logistics', name: 'Charger Logistics', imageUrl: '/images/clients-grayscale/charger-logistics.png', legacyMark: null },
    { id: 'logo-deloitte', name: 'Deloitte', imageUrl: '/images/clients-grayscale/deloitte.png', legacyMark: null },
    { id: 'logo-meta', name: 'Meta', imageUrl: '/images/clients-grayscale/meta.png', legacyMark: null },
    { id: 'logo-riverside-natural-foods', name: 'Riverside Natural Foods', imageUrl: '/images/clients-grayscale/riverside-natural-foods.png', legacyMark: null },
    { id: 'logo-canpar-express', name: 'Canpar Express', imageUrl: '/images/clients-grayscale/canpar-express.png', legacyMark: null },
    { id: 'logo-royal-building-products', name: 'Royal Building Products', imageUrl: '/images/clients-grayscale/royal-building-products.png', legacyMark: null },
    { id: 'logo-pernod-ricard', name: 'Pernod Ricard', imageUrl: '/images/clients-grayscale/pernod-ricard.png', legacyMark: null },
    { id: 'logo-empire-company', name: 'Empire Company', imageUrl: '/images/clients-grayscale/empire-company.png', legacyMark: null },
    { id: 'logo-scene', name: 'Scene', imageUrl: '/images/clients-grayscale/scene.png', legacyMark: null },
    { id: 'logo-hudsons-bay', name: "Hudson's Bay", imageUrl: '/images/clients-grayscale/hudsons-bay.png', legacyMark: null },
    { id: 'logo-sobeys', name: 'Sobeys', imageUrl: '/images/clients-grayscale/sobeys.png', legacyMark: null },
    { id: 'logo-pet-valu', name: 'Pet Valu', imageUrl: '/images/clients-grayscale/pet-valu.png', legacyMark: null },
    { id: 'logo-ahold-delhaize', name: 'Ahold Delhaize USA', imageUrl: '/images/clients-grayscale/ahold-delhaize.png', legacyMark: null },
  ],
  products: [
    {
      id: 'workflow-capture',
      name: 'Capture & Extract',
      kicker: 'DOCUMENT INTAKE',
      anchorId: 'capture-extract',
      introTitle: 'Bring every document into one intelligent flow.',
      introBody: 'Collect business documents from multiple sources and turn them into usable, structured data.',
      bridge: '',
      ctaLabel: 'Book Demo',
      features: [
        {
          id: 'capture',
          label: 'Capture',
          heading: 'Bring every document into one intelligent flow',
          body: 'Collect invoices, POs, GRNs, contracts, work orders, shipment records, and other industry-specific documents from multiple sources.',
          impact: 'Less manual collection and a faster start to every process.',
          video: video('capture', '/images/workflow/capture-illustration.png'),
        },
        {
          id: 'extract',
          label: 'Extract',
          heading: 'Turn documents into usable business data',
          body: 'Use AI to capture suppliers, references, dates, quantities, rates, amounts, taxes, and line items.',
          impact: 'Less data entry and more time for valuable work.',
          video: video('extract', '/images/workflow/extract-illustration.png'),
        },
      ],
    },
    {
      id: 'workflow-validate',
      name: 'Validate & Match',
      kicker: 'QUALITY AND RECONCILIATION',
      anchorId: 'validate-match',
      introTitle: 'Know what you can trust and find differences quickly.',
      introBody: 'Validate extracted information and compare related documents before data moves downstream.',
      bridge: '',
      ctaLabel: 'Book Demo',
      features: [
        {
          id: 'validate',
          label: 'Validate',
          heading: 'Know what you can trust',
          body: 'Check extracted information for missing fields, low-confidence values, inconsistencies, and other issues.',
          impact: 'Better data quality and fewer downstream errors.',
          video: video('validate', '/images/workflow/validate-illustration.png'),
        },
        {
          id: 'match',
          label: 'Match',
          heading: 'Find the differences without checking every line',
          body: 'Compare information using two-way and three-way matching and configured validation workflows.',
          impact: 'Faster reconciliation and less manual checking.',
          video: video('match', '/images/workflow/match-illustration.png'),
        },
      ],
    },
    {
      id: 'workflow-review',
      name: 'Review & Publish',
      kicker: 'HUMAN OVERSIGHT',
      anchorId: 'review-publish',
      introTitle: 'Focus attention where it matters.',
      introBody: 'Route discrepancies and uncertain records to the right people, then publish validated data to connected systems.',
      bridge: '',
      ctaLabel: 'Book Demo',
      features: [
        {
          id: 'review',
          label: 'Review',
          heading: 'Resolve exceptions with the original context',
          body: 'Review source documents, correct extracted values, and confirm information before it moves forward.',
          impact: 'Faster decisions with human oversight where needed.',
          video: video('review', '/images/workflow/review-illustration.png'),
        },
      ],
    },
  ],
};

const intro = (id: string, eyebrow: string, heading: string, lede: string): Section => ({
  id: `${id}-intro`, type: 'pageIntro', visible: true, eyebrow, heading, lede,
});
const managed = (id: string, key: string, label: string): Section => ({
  id, type: 'managed', visible: true, key, label, contentJson: '{}',
});

export const defaultHomeSections: Section[] = [
  {
    id: 'hero',
    type: 'hero',
    visible: true,
    // Non-breaking spaces, as in the original markup, so the gap around the bar survives.
    eyebrow: 'NEXTRACT | INTELLIGENT DOCUMENT PROCESSING',
    heading: 'Make your documents reveal what matters.',
    body: 'Nextract helps teams process invoices, POs, contracts, work orders, and more — from extraction and validation to matching, exception handling, AI insights, and integration.',
    ctaLabel: 'See Nextract in Action',
    video: {
      mp4: '',
      webm: '',
      poster: '/images/cta/app-preview.png',
    },
    fallbackImage: '/images/cta/app-preview.png',
  },
  { id: 'trust', type: 'trust', visible: true, headline: 'Trusted by companies and partners around the world' },
  { id: 'metrics', type: 'metrics', visible: true },
  { id: 'experiences', type: 'experiences', visible: true, ariaLabel: 'Capture, extract, validate, match, and review documents' },
  managed('home-workflow', 'workflow', 'Document workflow'),
  managed('home-solutions', 'solutions', 'Solutions'),
  { id: 'testimonials', type: 'testimonials', visible: true, heading: 'Real results. Less manual document work.' },
  {
    id: 'platform',
    type: 'platform',
    visible: true,
    heading: 'Connect Nextract to the way your business already works.',
    body: 'Turn incoming information into structured, validated data that moves through the systems and workflows your teams already rely on.',
    ctaLabel: 'Book Demo',
    diagram: {
      url: '/images/cta/app-preview.png',
      alt: 'Nextract document processing dashboard',
    },
    stages: [
      { id: 'stage-capture', name: 'Capture', detail: 'Bring documents into one flow', icon: 'package', tone: 'violet' },
      { id: 'stage-extract', name: 'Extract', detail: 'Turn documents into usable data', icon: 'database', tone: 'blue' },
      { id: 'stage-review', name: 'Review', detail: 'Resolve exceptions with context', icon: 'monitor', tone: 'coral' },
    ],
    mapNote: 'Validated information moves through the workflow.',
    systemsLabel: 'Connected systems',
    systems: [
      { id: 'sys-commerce', name: 'Commerce', icon: 'shopping-cart', tone: 'violet' },
      { id: 'sys-crm', name: 'CRM', icon: 'users', tone: 'blue' },
      { id: 'sys-pos', name: 'POS', icon: 'monitor', tone: 'teal' },
      { id: 'sys-erp', name: 'ERP', icon: 'database', tone: 'violet' },
      { id: 'sys-data', name: 'Customer Data', icon: 'database', tone: 'blue' },
      { id: 'sys-inventory', name: 'Inventory', icon: 'package', tone: 'coral' },
      { id: 'sys-support', name: 'Support', icon: 'headphones', tone: 'pink' },
    ],
  },
  managed('home-ai', 'aiAnswers', 'Nextract AI'),
  {
    id: 'faq',
    type: 'faq',
    visible: true,
    eyebrow: 'GOOD TO KNOW',
    heading: 'Frequently asked questions',
    image: { url: '/images/cta/app-preview.png', alt: 'Nextract document workflow' },
  },
  managed('home-demo', 'demoCta', 'Demo call to action'),
];

export const defaultContactSections: Section[] = [
  {
    id: 'contact-intro',
    type: 'pageIntro',
    visible: true,
    eyebrow: 'CONTACT US',
    heading: 'Let’s talk about your document workflow.',
    lede: 'Tell us where manual document work, matching, or exception handling is slowing your team down.',
  },
  {
    id: 'contact-form',
    type: 'contactForm',
    visible: true,
    heading: 'Tell us what you have in mind.',
    unavailableTitle: 'This form isn’t accepting messages yet.',
    unavailableNotice: 'Approved privacy material and a delivery destination are required. Nothing can be sent or retained while this form is unavailable.',
    inquiryTypes: ['Request a demo', 'Product question', 'Partnership', 'Other'],
    solutions: ['Document Processing', 'Invoice Automation', 'Document Matching', 'Multiple workflows', 'Not sure yet'],
    submitLabel: 'Send message',
    successMessage: 'Thanks — your message is on its way. We’ll review it and connect you with the right person.',
    aside: [
      {
        id: 'aside-help',
        heading: 'How can we help?',
        items: ['Request a tailored Nextract demo.', 'Discuss a document workflow.', 'Explore a partnership.'],
        body: '',
      },
      {
        id: 'aside-next',
        heading: 'What happens next?',
        items: [],
        body: 'We’ll review your message and connect you with the right person.',
      },
    ],
  },
  { id: 'contact-faq', type: 'faq', visible: true, eyebrow: 'GOOD TO KNOW', heading: 'Frequently asked questions', image: { url: '', alt: '' } },
  managed('contact-demo', 'demoCta', 'Demo call to action'),
];

// The /resources listing. Its intro is editable; the posts below it come
// from the Resources section of the admin.
export const defaultResourcesSections: Section[] = [
  {
    id: 'resources-intro',
    type: 'pageIntro',
    visible: true,
    eyebrow: 'RESOURCES',
    heading: 'Insights for document-heavy operations.',
    lede: 'Explore practical guidance, success stories, and events about document processing, matching, and automation.',
  },
  managed('resources-demo', 'demoCta', 'Demo call to action'),
];

export const defaultAboutSections: Section[] = [
  intro('about', 'ABOUT NEXTRACT', 'We turn document work into decisions.', 'Nextract helps teams capture, understand, validate, match, and act on the information inside business documents.'),
  managed('about-story', 'aboutStory', 'Company story'),
  { id: 'about-metrics', type: 'metrics', visible: true },
  { id: 'about-testimonials', type: 'testimonials', visible: true, heading: 'Real results. Less manual document work.' },
  managed('about-demo', 'demoCta', 'Demo call to action'),
];

export const defaultPricingSections: Section[] = [
  managed('pricing-hero', 'pricingHero', 'Pricing hero'),
  managed('pricing-plans', 'pricingPlans', 'Pricing plans'),
  managed('pricing-plan-comparison', 'planComparison', 'Plan comparison'),
  managed('pricing-competitor-comparison', 'competitorComparison', 'Competitor comparison'),
  managed('pricing-why', 'pricingWhy', 'Why Nextract'),
  managed('pricing-trial', 'pricingTrial', 'Trial call to action'),
  managed('pricing-faq', 'pricingFaq', 'Pricing FAQ'),
  managed('pricing-demo', 'demoCta', 'Demo call to action'),
];

export const defaultPartnershipSections: Section[] = [
  managed('partnership-hero', 'partnershipHero', 'Partnership hero'),
  managed('partnership-why', 'whyNextract', 'Why partner with Nextract'),
  managed('partnership-paths', 'partnershipPaths', 'Partnership paths'),
  managed('partnership-calculator', 'earningsCalculator', 'Earnings calculator'),
  managed('partnership-pilot', 'pilot', 'Pilot program'),
  managed('partnership-faq', 'partnershipFaq', 'Partnership FAQ'),
  managed('partnership-register', 'registerSection', 'Partner registration'),
  managed('partnership-demo', 'demoCta', 'Demo call to action'),
];

export const defaultPrivacySections: Section[] = [
  intro('privacy', 'LEGAL', 'Privacy Policy', 'How Nextract collects, uses, stores, and protects information.'),
  managed('privacy-content', 'privacyPolicy', 'Privacy policy content'),
  { id: 'privacy-faq', type: 'faq', visible: true, eyebrow: 'GOOD TO KNOW', heading: 'Frequently asked questions', image: { url: '', alt: '' } },
  managed('privacy-demo', 'demoCta', 'Demo call to action'),
];

export const defaultTermsSections: Section[] = [
  intro('terms', 'LEGAL', 'Terms & Conditions', 'The terms that govern use of Nextract websites, services, and materials.'),
  managed('terms-content', 'termsConditions', 'Terms and conditions content'),
  { id: 'terms-faq', type: 'faq', visible: true, eyebrow: 'GOOD TO KNOW', heading: 'Frequently asked questions', image: { url: '', alt: '' } },
  managed('terms-demo', 'demoCta', 'Demo call to action'),
];

export const defaultPages: Record<'home' | 'contact' | 'resources' | 'about' | 'pricing' | 'partnership' | 'privacy-policy' | 'terms-and-conditions', PublicPage> = {
  home: {
    slug: 'home',
    title: 'Home',
    excerpt: '',
    featuredImage: '',
    sections: defaultHomeSections,
    seo: {
      ...emptySeo,
      seoTitle: homeSeoTitle,
      metaDescription: homeMetaDescription,
      canonicalUrl: 'https://nextract.ca/',
      ogTitle: homeSeoTitle,
      ogDescription: homeMetaDescription,
      ogImage: 'https://nextract.ca/images/cta/app-preview.png',
      schemaJson: homeSeoSchema,
    },
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  contact: {
    slug: 'contact',
    title: 'Contact Us',
    excerpt: 'Tell us what you want to improve in your document workflows.',
    featuredImage: '',
    sections: defaultContactSections,
    seo: { ...emptySeo, seoTitle: 'Contact Nextract | Talk to Our Team' },
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  resources: {
    slug: 'resources',
    title: 'Resources',
    excerpt: 'Practical guidance on document processing, matching, and operational automation from Nextract.',
    featuredImage: '',
    sections: defaultResourcesSections,
    seo: { ...emptySeo, seoTitle: 'Resources | Nextract' },
    updatedAt: '2026-10-13T00:00:00.000Z',
  },
  about: {
    slug: 'about', title: 'About Us', excerpt: 'Learn why Nextract is building a better way to process business documents.', featuredImage: '', sections: defaultAboutSections,
    seo: { ...emptySeo, seoTitle: 'About Nextract | Intelligent Document Processing', schemaType: 'AboutPage' }, updatedAt: '2026-11-04T00:00:00.000Z',
  },
  pricing: {
    slug: 'pricing', title: 'Pricing', excerpt: 'Nextract plans and capabilities for document processing teams.', featuredImage: '', sections: defaultPricingSections,
    seo: { ...emptySeo, seoTitle: 'Pricing | Nextract', schemaType: 'WebPage' }, updatedAt: '2026-11-04T00:00:00.000Z',
  },
  partnership: {
    slug: 'partnership', title: 'Partnership', excerpt: 'Work with Nextract to bring intelligent document processing to more teams.', featuredImage: '', sections: defaultPartnershipSections,
    seo: { ...emptySeo, seoTitle: 'Partnership Program | Nextract', schemaType: 'WebPage' }, updatedAt: '2026-11-04T00:00:00.000Z',
  },
  'privacy-policy': {
    slug: 'privacy-policy', title: 'Privacy Policy', excerpt: 'How Nextract handles and protects information.', featuredImage: '', sections: defaultPrivacySections,
    seo: { ...emptySeo, seoTitle: 'Privacy Policy | Nextract', schemaType: 'WebPage' }, updatedAt: '2026-11-04T00:00:00.000Z',
  },
  'terms-and-conditions': {
    slug: 'terms-and-conditions', title: 'Terms & Conditions', excerpt: 'Terms governing use of Nextract websites and services.', featuredImage: '', sections: defaultTermsSections,
    seo: { ...emptySeo, seoTitle: 'Terms & Conditions | Nextract', schemaType: 'WebPage' }, updatedAt: '2026-11-04T00:00:00.000Z',
  },
};

const menu = (
  location: MenuLocation,
  items: Array<[label: string, url: string]>,
): PublicMenu => ({
  location,
  cta: { enabled: true, label: 'Get Demo' },
  items: items.map(([label, url], index) => ({
    id: `${location}-${index + 1}`,
    label,
    url,
    external: false,
    newTab: false,
    children: [],
  })),
});

// One header and one footer, applied across the whole site. Anchor links use
// the "/#id" form so they jump to the homepage section from any page.
export const defaultMenus: Record<MenuLocation, PublicMenu> = {
  header: menu('header', [
    ['Services', '/#solutions'],
    ['Features', '/#features'],
    ['Pricing', '/pricing'],
    ['Resources', '/resources'],
    ['About', '/about'],
  ]),
  footer: menu('footer', [
    ['Home', '/'],
    ['Services', '/#solutions'],
    ['Features', '/#features'],
    ['Pricing', '/pricing'],
    ['FAQ', '/#faq'],
    ['Resources', '/resources'],
    ['Contact Us', '/contact'],
  ]),
};

export const defaultSiteSettings: SiteSettings = {
  siteName: 'Nextract',
  logo: { url: '/images/brand/nextract-logo.svg', alt: 'Nextract' },
  footerLogo: { url: '', alt: '' },
  favicon: '/favicon.ico',
  contactEmail: '',
  phone: '',
  address: '',
  social: {},
  whatsapp: '',
  copyright: '© {year} Nextract. All rights reserved.',
  defaultSeoTitle: homeSeoTitle,
  defaultMetaDescription: homeMetaDescription,
  defaultOgImage: '/images/cta/app-preview.png',
  googleAnalyticsId: '',
  googleTagManagerId: '',
  maintenanceMode: false,
  maintenanceMessage: 'We’re making a few improvements and will be back shortly.',
  headerScripts: '',
  footerScripts: '',
  headerScriptsCategory: 'marketing',
  footerScriptsCategory: 'marketing',
  notificationEmail: '',
  robotsDisallow: [],
};

export const defaultDemoSettings: DemoSettings = {
  mode: 'dialog',
  url: '',
  ctaLabel: 'Book Demo',
  title: 'See Nextract in action',
  lede: 'Tell us about your document workflow and we will tailor the walkthrough around it.',
  interests: ['Document Processing', 'Invoice Automation', 'Document Matching', 'Not sure yet'],
  submitLabel: 'Request a demo',
  successTitle: 'Request received',
  successMessage: 'Thanks, {firstName}. We have your details and will reply to {email}.',
};

export const defaultFormSettings: FormSettings = {
  demoEnabled: true,
  contactEnabled: true,
};

export const defaultEmailSettings: EmailSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'Nextract',
  fromEmail: '',
};

export function publicSettingsFrom(
  settings: SiteSettings,
  demo: DemoSettings,
  forms: FormSettings,
): PublicSettings {
  return {
    siteName: settings.siteName,
    logo: settings.logo,
    footerLogo: settings.footerLogo,
    favicon: settings.favicon,
    contactEmail: settings.contactEmail,
    phone: settings.phone,
    address: settings.address,
    social: settings.social,
    whatsapp: settings.whatsapp,
    copyright: settings.copyright,
    defaultSeoTitle: settings.defaultSeoTitle,
    defaultMetaDescription: settings.defaultMetaDescription,
    defaultOgImage: settings.defaultOgImage,
    googleAnalyticsId: settings.googleAnalyticsId,
    googleTagManagerId: settings.googleTagManagerId,
    headerScripts: settings.headerScripts,
    footerScripts: settings.footerScripts,
    headerScriptsCategory: settings.headerScriptsCategory,
    footerScriptsCategory: settings.footerScriptsCategory,
    robotsDisallow: settings.robotsDisallow,
    demo,
    forms,
  };
}

// The bootstrap the site uses when the API is unreachable. Forms are switched
// off in this fallback: with no backend there is nowhere for a message to go.
export function fallbackBootstrap(path: string): SiteBootstrap {
  const clean = path.replace(/\/+$/, '') || '/';
  const slug = clean === '/' ? 'home' : clean.slice(1);
  const page = defaultPages[slug as keyof typeof defaultPages] ?? null;
  return {
    settings: publicSettingsFrom(defaultSiteSettings, defaultDemoSettings, {
      demoEnabled: false,
      contactEnabled: false,
    }),
    seo: defaultSeoSettings,
    theme: defaultThemeSettings,
    snippets: [],
    menus: defaultMenus,
    collections: defaultCollections,
    page,
    preview: false,
    generatedAt: 'fallback',
  };
}
