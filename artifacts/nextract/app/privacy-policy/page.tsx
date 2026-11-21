import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DemoCta } from "@/components/sections/DemoCta";
import { Faq } from "@/components/sections/Faq";
import { LegalContent } from "@/components/sections/LegalContent";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { privacyPolicy } from "@/lib/pages";
import { demoCta, faq as fallbackFaq } from "@/lib/content";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, managedContent, pageIntro, sectionIsVisible } from "@/lib/cms";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/privacy-policy'), '/privacy-policy', { title: 'Privacy Policy | Nextract', description: privacyPolicy.subtitle });
}

export default async function PrivacyPolicyPage() {
  await connection();
  const cms = await getCmsBootstrap("/privacy-policy");
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={cms} />;
  const intro = pageIntro(cms, privacyPolicy);
  const nav = cmsNav(cms);
  const faqContent = cms?.collections.faqs.length ? { ...fallbackFaq, items: cms.collections.faqs.map((item) => ({ question: item.question, answer: item.answer })) } : fallbackFaq;
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
        {sectionIsVisible(cms, "privacyPolicy") && <LegalContent page={managedContent(cms, "privacyPolicy", privacyPolicy)} />}
        {sectionIsVisible(cms, "privacy-faq") && <Faq content={faqContent} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
