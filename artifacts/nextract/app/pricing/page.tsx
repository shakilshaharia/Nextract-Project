import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DemoCta } from "@/components/sections/DemoCta";
import { CompetitorComparison } from "@/components/pricing/CompetitorComparison";
import { PlanComparison } from "@/components/pricing/PlanComparison";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PricingTrial } from "@/components/pricing/PricingTrial";
import { PricingWhy } from "@/components/pricing/PricingWhy";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { pricingMeta } from "@/lib/pricing";
import { competitorComparison, planComparison, plans, plansNote, pricingFaq, pricingHero, pricingTrial, pricingWhy } from "@/lib/pricing";
import { demoCta } from "@/lib/content";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, managedContent, sectionIsVisible } from "@/lib/cms";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/pricing'), '/pricing', { title: `${pricingMeta.title} | Nextract`, description: pricingMeta.description });
}

export default async function PricingPage() {
  await connection();
  const cms = await getCmsBootstrap("/pricing");
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={cms} />;
  const nav = cmsNav(cms);
  return (
    <>
      <main id="top">
        {sectionIsVisible(cms, "pricingHero") && <PricingHero content={managedContent(cms, "pricingHero", pricingHero)} navItems={nav.items} ctaLabel={nav.ctaLabel} demo={cmsDemo(cms)} />}
        {sectionIsVisible(cms, "pricingPlans") && <PricingPlans content={managedContent(cms, "pricingPlans", { plans, plansNote })} />}
        {sectionIsVisible(cms, "planComparison") && <PlanComparison content={managedContent(cms, "planComparison", planComparison)} />}
        {sectionIsVisible(cms, "competitorComparison") && <CompetitorComparison content={managedContent(cms, "competitorComparison", competitorComparison)} />}
        {sectionIsVisible(cms, "pricingWhy") && <PricingWhy content={managedContent(cms, "pricingWhy", pricingWhy)} />}
        {sectionIsVisible(cms, "pricingTrial") && <PricingTrial content={managedContent(cms, "pricingTrial", pricingTrial)} />}
        {sectionIsVisible(cms, "pricingFaq") && <PricingFaq content={managedContent(cms, "pricingFaq", pricingFaq)} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
