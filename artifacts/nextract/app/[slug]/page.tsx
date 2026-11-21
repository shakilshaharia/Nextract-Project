import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCmsBootstrap, cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, cmsPageJsonLd, managedContent, pageIntro, sectionIsVisible } from '@/lib/cms';
import { VisualPage } from '@/components/visual/Renderer';
import { PageHero } from '@/components/layout/PageHero';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CmsRichTextBlocks } from '@/components/sections/CmsRichText';
import { DemoCta } from '@/components/sections/DemoCta';
import { demoCta } from '@/lib/content';
export const instant = false;

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
  const {slug}=await params;const cms=await getCmsBootstrap(`/${slug}`);
  return cmsMetadata(cms,`/${slug}`,{title:cms?.page?.title || 'Nextract',description:cms?.page?.excerpt || ''});
}
export default async function ManagedPage({params}:{params:Promise<{slug:string}>}) {
  await connection();const {slug}=await params;
  // The homepage lives at "/"; /home would be a duplicate URL of the same page.
  if(slug==='home')permanentRedirect('/');
  const cms=await getCmsBootstrap(`/${slug}`);
  if(!cms?.page)notFound();
  if(cms.page.visualLayout)return <VisualPage layout={cms.page.visualLayout} cms={cms}/>;
  const intro=pageIntro(cms,{title:cms.page.title,subtitle:cms.page.excerpt});const nav=cmsNav(cms);
  const pageJsonLd=cmsPageJsonLd(cms);
  return <>{pageJsonLd?<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageJsonLd).replace(/</g,"\\u003c")}}/>:null}<main><PageHero {...intro} title={intro.title} navItems={nav.items} ctaLabel={nav.ctaLabel} demo={cmsDemo(cms)}/><CmsRichTextBlocks cms={cms}/></main>{sectionIsVisible(cms,"demoCta") && <DemoCta content={managedContent(cms,"demoCta",demoCta)} />}<SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} /></>;
}
