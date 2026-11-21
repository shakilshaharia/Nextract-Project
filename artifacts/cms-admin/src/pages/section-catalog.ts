import type { Section, VisualBlock } from "@workspace/cms-content";

const entries: Record<
  string,
  {
    name: string;
    description: string;
    image?: string;
    shared?: { label: string; href: string };
  }
> = {
  Hero: {
    name: "Hero banner",
    description: "Edit the main heading, introduction, image, or video.",
  },
  PageHero: {
    name: "Page introduction",
    description: "Edit the page heading and introduction.",
  },
  Stats: {
    name: "Statistics",
    description: "The results and figures shown on this page.",
    shared: { label: "statistics", href: "/collections/metrics" },
  },
  Workflow: {
    name: "Document workflow",
    description: "Edit each workflow step, illustration, and video.",
    image: "/images/workflow/capture-illustration.png",
  },
  Solutions: {
    name: "Solutions",
    description: "Edit the solution cards, descriptions, images, and videos.",
    image: "/images/solutions/shipment-photo.jpg",
  },
  Integrations: {
    name: "Platform overview",
    description: "Edit the heading, introduction, and platform video.",
  },
  AiAnswers: {
    name: "AI features",
    description: "Edit the AI feature descriptions, images, and videos.",
  },
  Testimonials: {
    name: "Customer testimonials",
    description: "Edit the heading and customer stories.",
    shared: { label: "testimonials", href: "/collections/testimonials" },
  },
  Faq: {
    name: "Frequently asked questions",
    description: "Edit the introduction, questions, and answers.",
    shared: { label: "FAQs", href: "/collections/faqs" },
  },
  DemoCta: {
    name: "Demo banner",
    description: "Edit the heading, button, and dashboard image.",
    image: "/images/cta/app-preview.png",
  },
  AboutStory: {
    name: "Company story",
    description: "Edit your company introduction and story.",
  },
  ContactForm: {
    name: "Contact section",
    description: "Edit the form introduction and supporting text.",
  },
  ResourceLibrary: {
    name: "Resource library",
    description: "Published articles, events, and customer stories.",
    shared: { label: "resources", href: "/posts" },
  },
  PricingHero: {
    name: "Pricing introduction",
    description: "Edit the pricing heading and introduction.",
  },
  PricingPlans: {
    name: "Pricing plans",
    description: "Edit plan names, descriptions, and included features.",
  },
  PlanComparison: {
    name: "Plan comparison",
    description: "Edit the features compared across your plans.",
  },
  CompetitorComparison: {
    name: "Competitor comparison",
    description: "Edit comparison headings and descriptions.",
  },
  PricingWhy: {
    name: "Why Nextract",
    description: "Edit the benefits of choosing Nextract.",
  },
  PricingTrial: {
    name: "Trial banner",
    description: "Edit the trial message and button.",
  },
  PricingFaq: {
    name: "Pricing questions",
    description: "Edit pricing questions and answers.",
  },
  PartnershipHero: {
    name: "Partner introduction",
    description: "Edit the partner heading and introduction.",
  },
  WhyNextract: {
    name: "Partner benefits",
    description: "Edit the benefits of partnering with Nextract.",
  },
  PartnershipPaths: {
    name: "Partnership options",
    description: "Edit the available partnership options.",
  },
  EarningsCalculator: {
    name: "Earnings calculator",
    description: "Edit the calculator heading and supporting text.",
  },
  PilotFaq: {
    name: "Pilot program and questions",
    description: "Edit the pilot introduction and partner questions.",
  },
  RegisterSection: {
    name: "Partner registration",
    description: "Edit the registration introduction and button.",
  },
  LegalContent: {
    name: "Policy content",
    description: "Edit the policy headings and paragraphs.",
  },
};
const managedKinds: Record<string, string> = {
  workflow: "Workflow",
  solutions: "Solutions",
  aiAnswers: "AiAnswers",
  demoCta: "DemoCta",
  aboutStory: "AboutStory",
  pricingHero: "PricingHero",
  pricingPlans: "PricingPlans",
  planComparison: "PlanComparison",
  competitorComparison: "CompetitorComparison",
  pricingWhy: "PricingWhy",
  pricingTrial: "PricingTrial",
  pricingFaq: "PricingFaq",
  partnershipHero: "PartnershipHero",
  whyNextract: "WhyNextract",
  partnershipPaths: "PartnershipPaths",
  earningsCalculator: "EarningsCalculator",
  pilot: "PilotFaq",
  partnershipFaq: "PilotFaq",
  registerSection: "RegisterSection",
  privacyPolicy: "LegalContent",
  termsConditions: "LegalContent",
};
const legacyKinds: Record<string, string> = {
  hero: "Hero",
  metrics: "Stats",
  testimonials: "Testimonials",
  platform: "Integrations",
  faq: "Faq",
  pageIntro: "PageHero",
  contactForm: "ContactForm",
};

function firstImage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  if (object.mode === "video") return;
  for (const key of ["src", "url", "poster", "fallbackImage"]) {
    const candidate = object[key];
    if (
      typeof candidate === "string" &&
      /\.(png|jpe?g|webp|avif|gif|svg)(?:[?#]|$)/i.test(candidate)
    )
      return candidate;
  }
  for (const child of Object.values(object)) {
    const result = firstImage(child);
    if (result) return result;
  }
  return undefined;
}
export function visualSectionInfo(block: VisualBlock) {
  const kind = block.props.kind ?? block.type;
  return {
    ...entries[kind],
    name:
      entries[kind]?.name ??
      `${block.type.replace(/([a-z])([A-Z])/g, "$1 $2")} section`,
    description:
      entries[kind]?.description ??
      "Edit the text, images, and videos in this section.",
    image:
      firstImage(block.props.content ?? block.props) ?? entries[kind]?.image,
  };
}
export function legacySectionInfo(section: Section) {
  const kind =
    section.type === "managed"
      ? managedKinds[section.key]
      : legacyKinds[section.type];
  const entry = entries[kind];
  const special =
    section.type === "trust"
      ? {
          name: "Client logos",
          description: "The introduction and logos of your clients.",
          shared: { label: "client logos", href: "/collections/logos" },
        }
      : section.type === "experiences"
        ? {
            name: "Product features",
            description: "Product cards, feature descriptions, and videos.",
            shared: {
              label: "products and features",
              href: "/collections/products",
            },
          }
        : undefined;
  let content: unknown = section;
  if (section.type === "managed") {
    try {
      content = JSON.parse(section.contentJson);
    } catch {
      /* The editor displays validation errors. */
    }
  }
  return {
    ...entry,
    ...special,
    name:
      special?.name ??
      entry?.name ??
      (section.type === "managed" ? section.label : "Text section"),
    description:
      special?.description ??
      entry?.description ??
      "Edit the headings and text in this section.",
    image: firstImage(content) ?? entry?.image,
  };
}
