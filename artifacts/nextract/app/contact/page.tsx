import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ContactForm } from "@/components/sections/ContactForm";
import { DemoCta } from "@/components/sections/DemoCta";
import { Faq } from "@/components/sections/Faq";
import { CmsRichTextBlocks } from "@/components/sections/CmsRichText";
import { contact } from "@/lib/pages";
import { demoCta, faq as fallbackFaq } from "@/lib/content";
import { cmsDemo, cmsFooterNav, cmsSocialLinks, cmsMetadata, cmsNav, getCmsBootstrap, managedContent, pageIntro, sectionIsVisible, visibleSection } from "@/lib/cms";
import { connection } from "next/server";
import { VisualPage } from '@/components/visual/Renderer';

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return cmsMetadata(await getCmsBootstrap('/contact'), '/contact', { title: 'Contact Us | Nextract', description: contact.subtitle });
}

export default async function ContactPage() {
  await connection();
  const cms = await getCmsBootstrap("/contact");
  if (cms?.page?.visualLayout) return <VisualPage layout={cms.page.visualLayout} cms={cms} />;
  const intro = pageIntro(cms, contact);
  const nav = cmsNav(cms);
  const formSection = visibleSection(cms, "contactForm");
  const formContent = {
    ...contact,
    form: {
      ...contact.form,
      heading: typeof formSection?.heading === "string" ? formSection.heading : contact.form.heading,
      submit: typeof formSection?.submitLabel === "string" ? formSection.submitLabel : contact.form.submit,
    },
  };
  const faqContent = cms?.collections.faqs.length ? { ...fallbackFaq, items: cms.collections.faqs.map((item) => ({ question: item.question, answer: item.answer })) } : fallbackFaq;
  return (
    <>
      <main>
        <PageHero title={intro.title} subtitle={intro.subtitle} eyebrow={intro.eyebrow} navItems={nav.items} ctaLabel={nav.ctaLabel} demo={cmsDemo(cms)} />
        {sectionIsVisible(cms, "contactForm") && <ContactForm content={formContent} />}
        {sectionIsVisible(cms, "faq") && <Faq content={faqContent} />}
        <CmsRichTextBlocks cms={cms} />
        {sectionIsVisible(cms, "demoCta") && <DemoCta content={managedContent(cms, "demoCta", demoCta)} />}
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
