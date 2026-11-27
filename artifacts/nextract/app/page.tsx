import { SiteFooter } from "@/components/layout/SiteFooter";
import { AiAnswers } from "@/components/sections/AiAnswers";
import { DemoCta } from "@/components/sections/DemoCta";
import { Faq } from "@/components/sections/Faq";
import { Hero } from "@/components/sections/Hero";
import { Integrations } from "@/components/sections/Integrations";
import { Solutions } from "@/components/sections/Solutions";
import { Stats } from "@/components/sections/Stats";
import { Testimonials } from "@/components/sections/Testimonials";
import { Workflow } from "@/components/sections/Workflow";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { cmsDemo, cmsFaqJsonLd, cmsFooterNav, cmsSocialLinks, cmsLogos, cmsMetadata, cmsNav, cmsPageJsonLd, getCmsBootstrap, managedContent, sectionIsVisible, visibleSection } from "@/lib/cms";
import type { Metadata } from "next";
import { aiAnswers, demoCta, faq as fallbackFaq, hero as fallbackHero, integrations as fallbackIntegrations, solutions, testimonials as fallbackTestimonials, workflow } from "@/lib/content";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/'), '/', { title: 'Nextract', description: fallbackHero.description });
}

const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;

export default async function Home() {
  // The published CMS is read for each request. `connection()` opts this page
  // out of prerendering when Cache Components is enabled in Next.js 16.
  await connection();
  const cms = await getCmsBootstrap("/");
  // The homepage shows the FAQ section, so emit FAQPage schema (plus any custom
  // page schema) regardless of whether it renders via the visual builder.
  const homeSchemas = [cmsFaqJsonLd(cms), cmsPageJsonLd(cms)].filter(Boolean);
  const homeJsonLd = homeSchemas.map((schema, index) => (
    <script
      key={index}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
    />
  ));
  if (cms?.page?.visualLayout) return <>{homeJsonLd}<VisualPage layout={cms.page.visualLayout} cms={cms} /></>;
  const heroSection = visibleSection(cms, "hero");
  const platformSection = visibleSection(cms, "platform");
  const faqSection = visibleSection(cms, "faq");
  const heading = text(heroSection?.heading, `${fallbackHero.titleLead} ${fallbackHero.titleTrail}`);
  const titleLead = heading.startsWith("Make your documents") ? "Make your documents" : heading;
  const titleTrail = heading.startsWith("Make your documents") ? heading.slice("Make your documents".length).trim() : "";
  const homeMenu = cms?.menus["header"];
  const navItems = cmsNav(cms).items;
  const heroContent = {
    ...fallbackHero,
    titleLead,
    titleTrail,
    description: text(heroSection?.body, fallbackHero.description),
    cta: { label: text(heroSection?.ctaLabel, fallbackHero.cta.label), href: fallbackHero.cta.href },
  };
  const integrationContent = {
    ...fallbackIntegrations,
    title: text(platformSection?.heading, fallbackIntegrations.title),
    description: text(platformSection?.body, fallbackIntegrations.description),
  };
  const testimonialContent = cms?.collections.testimonials.length ? {
    ...fallbackTestimonials,
    title: text(visibleSection(cms, "testimonials")?.heading, fallbackTestimonials.title),
    items: cms.collections.testimonials.map((item) => ({
      quote: item.quote,
      stat: item.outcome,
      statDescription: item.explanation,
      name: item.segment,
      role: item.role,
    })),
  } : fallbackTestimonials;
  const faqContent = cms?.collections.faqs.length ? {
    ...fallbackFaq,
    title: text(faqSection?.heading, fallbackFaq.title),
    items: cms.collections.faqs.map((item) => ({ question: item.question, answer: item.answer })),
  } : fallbackFaq;

  return (
    <>
      {homeJsonLd}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main id="main">
        {sectionIsVisible(cms, "hero") && <Hero content={heroContent} navItems={navItems} ctaLabel={homeMenu?.cta.enabled ? homeMenu.cta.label : undefined} logos={cmsLogos(cms)} demo={cmsDemo(cms)} />}
        {sectionIsVisible(cms, "metrics") && <Stats items={cms?.collections.metrics} />}
        {sectionIsVisible(cms, "workflow") && <Workflow content={managedContent(cms, "workflow", workflow)} />}
        {sectionIsVisible(cms, "solutions") && <Solutions content={managedContent(cms, "solutions", solutions)} />}
        {sectionIsVisible(cms, "platform") && <Integrations content={integrationContent} />}
        {sectionIsVisible(cms, "aiAnswers") && <AiAnswers content={managedContent(cms, "aiAnswers", aiAnswers)} />}
        {sectionIsVisible(cms, "testimonials") && <Testimonials content={testimonialContent} />}
        {sectionIsVisible(cms, "faq") && <Faq content={faqContent} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
