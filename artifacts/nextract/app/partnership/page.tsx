import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DemoCta } from "@/components/sections/DemoCta";
import { EarningsCalculator } from "@/components/partnership/EarningsCalculator";
import { PartnershipHero } from "@/components/partnership/PartnershipHero";
import { PartnershipPaths } from "@/components/partnership/PartnershipPaths";
import { PilotFaq } from "@/components/partnership/PilotFaq";
import { RegisterSection } from "@/components/partnership/RegisterSection";
import { WhyNextract } from "@/components/partnership/WhyNextract";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { earningsCalculator, partnershipFaq, partnershipHero, partnershipMeta, partnershipPaths, pilot, registerSection, whyNextract } from "@/lib/partnership";
import { demoCta } from "@/lib/content";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, managedContent, sectionIsVisible } from "@/lib/cms";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/partnership'), '/partnership', { title: `${partnershipMeta.title} | Nextract`, description: partnershipMeta.description });
}

export default async function PartnershipPage() {
  await connection();
  const cms = await getCmsBootstrap("/partnership");
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={cms} />;
  const nav = cmsNav(cms);
  return (
    <>
      <main id="top">
        {sectionIsVisible(cms, "partnershipHero") && <PartnershipHero content={managedContent(cms, "partnershipHero", partnershipHero)} navItems={nav.items} ctaLabel={nav.ctaLabel} demo={cmsDemo(cms)} />}
        {sectionIsVisible(cms, "whyNextract") && <WhyNextract content={managedContent(cms, "whyNextract", whyNextract)} />}
        {sectionIsVisible(cms, "partnershipPaths") && <PartnershipPaths content={managedContent(cms, "partnershipPaths", partnershipPaths)} />}
        {sectionIsVisible(cms, "earningsCalculator") && <EarningsCalculator content={managedContent(cms, "earningsCalculator", earningsCalculator)} />}
        {(sectionIsVisible(cms, "pilot") || sectionIsVisible(cms, "partnershipFaq")) && <PilotFaq pilotContent={managedContent(cms, "pilot", pilot)} faqContent={managedContent(cms, "partnershipFaq", partnershipFaq)} />}
        {sectionIsVisible(cms, "registerSection") && <RegisterSection content={managedContent(cms, "registerSection", registerSection)} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
