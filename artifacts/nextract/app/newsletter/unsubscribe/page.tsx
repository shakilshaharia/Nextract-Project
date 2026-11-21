import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cmsDemo, cmsFooterNav, cmsNav, cmsSocialLinks, getCmsBootstrap } from "@/lib/cms";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const instant = false;

const cmsApi = (process.env.CMS_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await connection();
  const { token } = await searchParams;
  const cms = await getCmsBootstrap("/");
  const nav = cmsNav(cms);

  let ok = false;
  let message = "This unsubscribe link is invalid.";
  if (token) {
    const res = await fetch(`${cmsApi}/api/public/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (data?.ok) { ok = true; message = data.message || "You have been unsubscribed."; }
    else if (data?.message) message = data.message;
  }

  return (
    <>
      <main>
        <PageHero
          eyebrow="Newsletter"
          title={ok ? "You've been unsubscribed" : "Unsubscribe failed"}
          subtitle={message}
          navItems={nav.items}
          ctaLabel={nav.ctaLabel}
          demo={cmsDemo(cms)}
        />
      </main>
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
