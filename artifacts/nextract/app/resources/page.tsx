import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DemoCta } from "@/components/sections/DemoCta";
import { ResourceLibrary } from "@/components/sections/ResourceLibrary";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { resourcesPage } from "@/lib/pages";
import { demoCta } from "@/lib/content";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, getCmsResources, managedContent, pageIntro, sectionIsVisible } from "@/lib/cms";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/resources'), '/resources', { title: 'Resources | Nextract', description: resourcesPage.subtitle });
}

export default async function ResourcesPage() {
  await connection();
  const [cms, cmsResources] = await Promise.all([getCmsBootstrap("/resources"), getCmsResources()]);
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={{...cms,resources:cmsResources}} />;
  const intro = pageIntro(cms, resourcesPage);
  const nav = cmsNav(cms);
  const typeLabel = { BLOG: "Blog", USE_CASE: "Success Stories", EVENT: "Events" } as const;
  const library = cmsResources ? {
    ...resourcesPage,
    filters: ["All", "Blog", "Success Stories", "Events"],
    items: cmsResources.map((item) => ({
      category: typeLabel[item.type],
      meta: item.type === "EVENT" && item.event ? `${item.event.format} · ${new Date(item.event.startsAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}` : typeLabel[item.type],
      title: item.title,
      description: item.summary,
      href: item.path,
      ...(item.cover ? { image: item.cover.src } : {}),
    })),
  } : resourcesPage;
  return (
    <>
      <main>
        <PageHero
          align="left"
          eyebrow={intro.eyebrow}
          title={intro.title}
          subtitle={intro.subtitle}
          navItems={nav.items}
          ctaLabel={nav.ctaLabel}
          demo={cmsDemo(cms)}
        />
        <ResourceLibrary content={library} />
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
