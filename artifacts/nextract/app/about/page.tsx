import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AboutStory } from "@/components/sections/AboutStory";
import { DemoCta } from "@/components/sections/DemoCta";
import { Stats } from "@/components/sections/Stats";
import { Testimonials } from "@/components/sections/Testimonials";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { aboutPage } from "@/lib/pages";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, managedContent, pageIntro, sectionIsVisible } from "@/lib/cms";
import { demoCta, testimonials as fallbackTestimonials } from "@/lib/content";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/about'), '/about', { title: 'About Us | Nextract', description: aboutPage.subtitle });
}

export default async function AboutPage() {
  await connection();
  const cms = await getCmsBootstrap("/about");
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={cms} />;
  const intro = pageIntro(cms, aboutPage);
  const nav = cmsNav(cms);
  const story = managedContent(cms, "aboutStory", aboutPage);
  const demo = managedContent(cms, "demoCta", demoCta);
  const testimonials = cms?.collections.testimonials.length ? {
    ...fallbackTestimonials,
    items: cms.collections.testimonials.map((item) => ({ quote: item.quote, stat: item.outcome, statDescription: item.explanation, name: item.segment, role: item.role })),
  } : fallbackTestimonials;
  return (
    <>
      <main>
        <PageHero
          eyebrow={intro.eyebrow}
          title={intro.title}
          subtitle={intro.subtitle}
          navItems={nav.items}
          ctaLabel={nav.ctaLabel}
          demo={cmsDemo(cms)}
        />
        {sectionIsVisible(cms, "aboutStory") && <AboutStory content={story} />}
        {sectionIsVisible(cms, "about-metrics") && <Stats items={cms?.collections.metrics} />}
        {sectionIsVisible(cms, "about-testimonials") && <Testimonials content={testimonials} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={demo} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
