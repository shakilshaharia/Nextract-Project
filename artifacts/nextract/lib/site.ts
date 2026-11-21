/**
 * Link destinations used across the site.
 *
 * The Figma file does not specify a booking service, contact address, or destinations
 * for most footer/social links. Demo and contact CTAs point at the on-page demo section
 * until a real booking URL is provided. Footer and social items with `href: null`
 * render as plain text so there are no dead links.
 */
export const links = {
  home: "/",
  bookDemo: "#demo",
  contact: "/contact",
  about: "/about",
  pricing: "/pricing",
  resources: "/resources",
  privacy: "/privacy-policy",
  terms: "/terms-and-conditions",
};

/** A navigation link, optionally with a one-level dropdown of child links. */
export type NavLink = { label: string; href: string; newTab?: boolean; children?: NavLink[] };

/** Section anchors used by the primary navigation. */
export const sectionIds = {
  top: "top",
  solutions: "solutions",
  features: "features",
  integrations: "integrations",
  faq: "faq",
  testimonials: "testimonials",
  demo: "demo",
} as const;
