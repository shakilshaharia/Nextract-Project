"use client";
import type { ComponentProps, ReactNode } from "react";
import { Hero } from "../sections/Hero";
import { PageHero } from "../layout/PageHero";
import { Stats } from "../sections/Stats";
import { Workflow } from "../sections/Workflow";
import { Solutions } from "../sections/Solutions";
import { Integrations } from "../sections/Integrations";
import { AiAnswers, aiAnswers } from "../sections/AiAnswers";
import { Testimonials } from "../sections/Testimonials";
import { Faq } from "../sections/Faq";
import { DemoCta } from "../sections/DemoCta";
import { AboutStory } from "../sections/AboutStory";
import { ContactForm } from "../sections/ContactForm";
import { LegalContent } from "../sections/LegalContent";
import { ResourceLibrary } from "../sections/ResourceLibrary";
import { PricingHero } from "../pricing/PricingHero";
import { PricingPlans } from "../pricing/PricingPlans";
import { PlanComparison } from "../pricing/PlanComparison";
import { CompetitorComparison } from "../pricing/CompetitorComparison";
import { PricingWhy } from "../pricing/PricingWhy";
import { PricingTrial } from "../pricing/PricingTrial";
import { PricingFaq } from "../pricing/PricingFaq";
import { PartnershipHero } from "../partnership/PartnershipHero";
import { WhyNextract } from "../partnership/WhyNextract";
import { PartnershipPaths } from "../partnership/PartnershipPaths";
import { EarningsCalculator } from "../partnership/EarningsCalculator";
import { PilotFaq } from "../partnership/PilotFaq";
import { RegisterSection } from "../partnership/RegisterSection";
import * as home from "@/lib/content";
import * as pages from "@/lib/pages";
import * as pricing from "@/lib/pricing";
import * as partner from "@/lib/partnership";
import {
  cmsDemo,
  cmsLogos,
  cmsNav,
  managedContent,
  pageIntro,
  sectionIsVisible,
  visibleSection,
  type CmsBootstrap,
  type CmsResourceSummary,
} from "@/lib/cms";
import type {
  VisualBlock,
  VisualLayout,
  websiteKinds,
} from "@workspace/cms-content";

type Kind = (typeof websiteKinds)[number];
export type WebsiteDefinition = {
  defaults: Record<string, unknown>;
  render: (
    content: Record<string, unknown>,
    cms: CmsBootstrap | null,
    editable?: Record<string, ReactNode>,
  ) => ReactNode;
};
// These adapters call the original components. Only their serializable content
// props are editable; navigation and shared collections retain CMS connections.
function contentAdapter<T extends object>(
  Component: (props: { content?: T }) => ReactNode,
  defaults: T,
): WebsiteDefinition {
  return {
    defaults: defaults as Record<string, unknown>,
    render: (value) => <Component content={conform(defaults, value) as T} />,
  };
}
// Reconcile saved data with the component's real prop shape. Unknown keys and
// wrong primitive types cannot cause a component to execute arbitrary props.
export function conform(base: unknown, value: unknown): unknown {
  if (Array.isArray(base))
    return Array.isArray(value)
      ? value.slice(0, 100).map((v, i) => conform(base[i] ?? base[0], v))
      : base;
  if (base && typeof base === "object")
    return Object.fromEntries(
      Object.entries(base).map(([k, v]) => [
        k,
        conform(
          v,
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[k]
            : undefined,
        ),
      ]),
    );
  return typeof base === typeof value ? value : base;
}
export const website: Record<Kind, WebsiteDefinition> = {
  Hero: {
    defaults: home.hero,
    render: (c, cms, editable) => (
      <Hero
        editable={editable}
        content={conform(home.hero, c) as typeof home.hero}
        navItems={cmsNav(cms).items}
        ctaLabel={cmsNav(cms).ctaLabel}
        logos={cmsLogos(cms)}
        demo={cmsDemo(cms)}
      />
    ),
  },
  PageHero: {
    defaults: {
      title: "Page title",
      subtitle: "",
      eyebrow: "",
      align: "center",
    },
    render: (c, cms, editable) => (
      <PageHero
        {...(conform(
          { title: "", subtitle: "", eyebrow: "", align: "center" },
          c,
        ) as ComponentProps<typeof PageHero>)}
        editable={editable}
        navItems={cmsNav(cms).items}
        ctaLabel={cmsNav(cms).ctaLabel}
        demo={cmsDemo(cms)}
      />
    ),
  },
  Stats: {
    defaults: {},
    render: (_, cms) => <Stats items={cms?.collections.metrics} />,
  },
  Workflow: contentAdapter(Workflow, home.workflow),
  Solutions: contentAdapter(Solutions, home.solutions),
  Integrations: contentAdapter(Integrations, home.integrations),
  AiAnswers: contentAdapter(AiAnswers, aiAnswers),
  Testimonials: {
    defaults: { title: home.testimonials.title },
    render: (c, cms) => (
      <Testimonials
        content={{
          ...home.testimonials,
          title: String(c.title ?? home.testimonials.title),
          ...(cms?.collections.testimonials.length
            ? {
                items: cms.collections.testimonials.map((i) => ({
                  quote: i.quote,
                  stat: i.outcome,
                  statDescription: i.explanation,
                  name: i.segment,
                  role: i.role,
                })),
              }
            : {}),
        }}
      />
    ),
  },
  Faq: {
    defaults: {
      title: home.faq.title,
      subtitle: home.faq.subtitle,
      description: home.faq.description,
    },
    render: (c, cms) => (
      <Faq
        content={{
          ...home.faq,
          title: String(c.title ?? home.faq.title),
          subtitle: String(c.subtitle ?? home.faq.subtitle),
          description: String(c.description ?? home.faq.description),
          ...(cms?.collections.faqs.length
            ? {
                items: cms.collections.faqs.map((i) => ({
                  question: i.question,
                  answer: i.answer,
                })),
              }
            : {}),
        }}
      />
    ),
  },
  DemoCta: {
    defaults: home.demoCta,
    render: (c, _cms, editable) => (
      <DemoCta
        content={conform(home.demoCta, c) as typeof home.demoCta}
        editable={editable}
      />
    ),
  },
  AboutStory: contentAdapter(AboutStory, pages.aboutPage),
  ContactForm: contentAdapter(ContactForm, pages.contact),
  LegalContent: {
    defaults: pages.privacyPolicy,
    render: (c) => (
      <LegalContent
        page={conform(pages.privacyPolicy, c) as typeof pages.privacyPolicy}
      />
    ),
  },
  PricingHero: {
    defaults: pricing.pricingHero,
    render: (c, cms) => (
      <PricingHero
        content={conform(pricing.pricingHero, c) as typeof pricing.pricingHero}
        navItems={cmsNav(cms).items}
        ctaLabel={cmsNav(cms).ctaLabel}
        demo={cmsDemo(cms)}
      />
    ),
  },
  PricingPlans: contentAdapter(PricingPlans, {
    plans: pricing.plans,
    plansNote: pricing.plansNote,
  }),
  PlanComparison: contentAdapter(PlanComparison, pricing.planComparison),
  CompetitorComparison: contentAdapter(
    CompetitorComparison,
    pricing.competitorComparison,
  ),
  PricingWhy: contentAdapter(PricingWhy, pricing.pricingWhy),
  PricingTrial: contentAdapter(PricingTrial, pricing.pricingTrial),
  PricingFaq: contentAdapter(PricingFaq, pricing.pricingFaq),
  PartnershipHero: {
    defaults: partner.partnershipHero,
    render: (c, cms) => (
      <PartnershipHero
        content={
          conform(partner.partnershipHero, c) as typeof partner.partnershipHero
        }
        navItems={cmsNav(cms).items}
        ctaLabel={cmsNav(cms).ctaLabel}
        demo={cmsDemo(cms)}
      />
    ),
  },
  WhyNextract: contentAdapter(WhyNextract, partner.whyNextract),
  PartnershipPaths: contentAdapter(PartnershipPaths, partner.partnershipPaths),
  EarningsCalculator: contentAdapter(
    EarningsCalculator,
    partner.earningsCalculator,
  ),
  PilotFaq: {
    defaults: { pilot: partner.pilot, faq: partner.partnershipFaq },
    render: (c) => (
      <PilotFaq
        pilotContent={conform(partner.pilot, c.pilot) as typeof partner.pilot}
        faqContent={
          conform(
            partner.partnershipFaq,
            c.faq,
          ) as typeof partner.partnershipFaq
        }
      />
    ),
  },
  RegisterSection: contentAdapter(RegisterSection, partner.registerSection),
  ResourceLibrary: {
    defaults: {
      sectionTitle: pages.resourcesPage.sectionTitle,
      searchLabel: pages.resourcesPage.searchLabel,
    },
    render: (c, cms) => (
      <ResourceLibrary
        content={{
          ...pages.resourcesPage,
          sectionTitle: String(
            c.sectionTitle ?? pages.resourcesPage.sectionTitle,
          ),
          searchLabel: String(c.searchLabel ?? pages.resourcesPage.searchLabel),
          ...(cms?.resources
            ? {
                filters: ["All", "Blog", "Success Stories", "Events"],
                items: cms.resources.map((i) => ({
                  category:
                    i.type === "BLOG"
                      ? "Blog"
                      : i.type === "EVENT"
                        ? "Events"
                        : "Success Stories",
                  meta:
                    i.type === "BLOG"
                      ? "Blog"
                      : i.type === "EVENT"
                        ? "Events"
                        : "Success Stories",
                  title: i.title,
                  description: i.summary,
                  href: i.path,
                  ...(i.cover ? { image: i.cover.src } : {}),
                })),
              }
            : {}),
        }}
      />
    ),
  },
};

export function migratePage(
  cms: CmsBootstrap,
  resources?: CmsResourceSummary[] | null,
): VisualLayout {
  const slug = cms.page?.slug ?? "";
  const blocks: VisualBlock[] = [];
  const add = (kind: Kind, key: string, content?: Record<string, unknown>) => {
    if (!sectionIsVisible(cms, key)) return;
    blocks.push({
      type: "Website",
      props: {
        id: `website-${key}`,
        kind,
        content: content ?? managedContent(cms, key, website[kind].defaults),
      },
    });
  };
  const rich = () => {
    for (const section of cms.page?.sections ?? [])
      if (
        section.type === "richText" &&
        section.visible &&
        String(section.html ?? "").trim()
      )
        blocks.push({
          type: "RichText",
          props: { id: `rich-${section.id}`, text: String(section.html ?? "") },
        });
  };
  const intro = (
    fallback: { title: string; subtitle: string; eyebrow?: string },
    align = "center",
  ) => add("PageHero", "intro", { ...pageIntro(cms, fallback), align });
  if (slug === "home") {
    const h = visibleSection(cms, "hero");
    const heading = String(
      h?.heading || `${home.hero.titleLead} ${home.hero.titleTrail}`,
    );
    add("Hero", "hero", {
      ...home.hero,
      titleLead: heading.startsWith("Make your documents")
        ? "Make your documents"
        : heading,
      titleTrail: heading.startsWith("Make your documents")
        ? heading.slice(19).trim()
        : "",
      description: h?.body || home.hero.description,
      cta: { ...home.hero.cta, label: h?.ctaLabel || home.hero.cta.label },
    });
    add("Stats", "metrics");
    add("Workflow", "workflow");
    add("Solutions", "solutions");
    const p = visibleSection(cms, "platform");
    add("Integrations", "platform", {
      ...home.integrations,
      title: p?.heading || home.integrations.title,
      description: p?.body || home.integrations.description,
    });
    add("AiAnswers", "aiAnswers");
    add("Testimonials", "testimonials", {
      title:
        visibleSection(cms, "testimonials")?.heading || home.testimonials.title,
    });
    add("Faq", "faq", {
      title: visibleSection(cms, "faq")?.heading || home.faq.title,
      subtitle: home.faq.subtitle,
      description: home.faq.description,
    });
  } else if (slug === "about") {
    intro(pages.aboutPage);
    add("AboutStory", "aboutStory");
    add("Stats", "about-metrics");
    add("Testimonials", "about-testimonials");
  } else if (slug === "contact") {
    intro(pages.contact);
    const f = visibleSection(cms, "contactForm");
    add("ContactForm", "contactForm", {
      ...pages.contact,
      form: {
        ...pages.contact.form,
        heading: f?.heading || pages.contact.form.heading,
        submit: f?.submitLabel || pages.contact.form.submit,
      },
    });
    add("Faq", "faq");
  } else if (slug === "pricing") {
    for (const [kind, key] of [
      ["PricingHero", "pricingHero"],
      ["PricingPlans", "pricingPlans"],
      ["PlanComparison", "planComparison"],
      ["CompetitorComparison", "competitorComparison"],
      ["PricingWhy", "pricingWhy"],
      ["PricingTrial", "pricingTrial"],
      ["PricingFaq", "pricingFaq"],
    ] as [Kind, string][])
      add(kind, key);
  } else if (slug === "partnership") {
    for (const [kind, key] of [
      ["PartnershipHero", "partnershipHero"],
      ["WhyNextract", "whyNextract"],
      ["PartnershipPaths", "partnershipPaths"],
      ["EarningsCalculator", "earningsCalculator"],
    ] as [Kind, string][])
      add(kind, key);
    if (
      sectionIsVisible(cms, "pilot") ||
      sectionIsVisible(cms, "partnershipFaq")
    )
      blocks.push({
        type: "Website",
        props: {
          id: "website-pilot",
          kind: "PilotFaq",
          content: {
            pilot: managedContent(cms, "pilot", partner.pilot),
            faq: managedContent(cms, "partnershipFaq", partner.partnershipFaq),
          },
        },
      });
    add("RegisterSection", "registerSection");
  } else if (slug === "resources") {
    intro(pages.resourcesPage, "left");
    const content = resources?.length
      ? {
          ...pages.resourcesPage,
          filters: ["All", "Blog", "Success Stories", "Events"],
          items: resources.map((i) => ({
            category:
              i.type === "BLOG"
                ? "Blog"
                : i.type === "EVENT"
                  ? "Events"
                  : "Success Stories",
            meta:
              i.type === "BLOG"
                ? "Blog"
                : i.type === "EVENT"
                  ? "Events"
                  : "Success Stories",
            title: i.title,
            description: i.summary,
            href: i.path,
            ...(i.cover ? { image: i.cover.src } : {}),
          })),
        }
      : pages.resourcesPage;
    add("ResourceLibrary", "resourceLibrary", content);
  } else if (slug === "privacy-policy" || slug === "terms-and-conditions") {
    const privacy = slug === "privacy-policy";
    intro(privacy ? pages.privacyPolicy : pages.termsConditions);
    add(
      "LegalContent",
      privacy ? "privacyPolicy" : "termsConditions",
      managedContent(
        cms,
        privacy ? "privacyPolicy" : "termsConditions",
        privacy ? pages.privacyPolicy : pages.termsConditions,
      ),
    );
    add("Faq", privacy ? "privacy-faq" : "terms-faq");
  } else {
    for (const s of cms.page?.sections ?? [])
      if (s.type === "pageIntro" && s.visible)
        add("PageHero", "intro", {
          title: s.heading || cms.page?.title,
          subtitle: s.lede || "",
          eyebrow: s.eyebrow || "",
          align: "center",
        });
  }
  rich();
  if (
    [
      "home",
      "about",
      "contact",
      "pricing",
      "partnership",
      "resources",
      "privacy-policy",
      "terms-and-conditions",
    ].includes(slug)
  )
    add("DemoCta", "demoCta");
  return { root: { props: { title: cms.page?.title ?? "" } }, content: blocks };
}
