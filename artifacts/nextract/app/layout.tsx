import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IBM_Plex_Serif, Inter, Stack_Sans_Text } from "next/font/google";
import { Campaigns } from "@/components/layout/Campaigns";
import { RuntimeScripts } from "@/components/layout/RuntimeScripts";
import { cmsSiteJsonLd, cmsSiteMetadata, cmsSnippets, cmsTheme, getCmsBootstrap } from "@/lib/cms";
import { seo, seoKeywords, siteUrl } from "@/lib/seo";
import "./globals.css";

// Inter with the optical-size axis covers both "Inter" (opsz 14) and "Inter Display" (opsz 32).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const stackSansText = Stack_Sans_Text({
  variable: "--font-stack-sans",
  subsets: ["latin"],
  weight: ["300", "400"],
  // Google does not publish override metrics for this family. The browser's
  // normal sans-serif fallback is preferable to a noisy build-time guess.
  adjustFontFallback: false,
});

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: "400",
});

// Site-wide defaults + verification come from the CMS SEO settings, with the
// bundled values as a fallback when the CMS is unreachable. Individual pages
// override title, description, canonical, robots and Open Graph.
export async function generateMetadata(): Promise<Metadata> {
  const cms = await getCmsBootstrap("/");
  const settings = cms?.settings;
  const title = settings?.defaultSeoTitle || seo.title;
  const description = settings?.defaultMetaDescription || seo.description;
  const ogImage = settings?.defaultOgImage || "";

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords: seoKeywords,
    category: seo.category,
    alternates: { canonical: "/" },
    ...(settings?.favicon ? { icons: { icon: settings.favicon } } : {}),
    openGraph: {
      type: "website",
      url: "/",
      siteName: settings?.siteName || "Nextract",
      title,
      description,
      locale: "en_CA",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: cms?.seo.twitterCard || "summary",
      title,
      description,
      ...(cms?.seo.twitterSite ? { site: cms.seo.twitterSite } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": cms?.seo.maxImagePreview ?? "large",
        "max-snippet": cms?.seo.maxSnippet ?? -1,
        "max-video-preview": cms?.seo.maxVideoPreview ?? -1,
      },
    },
    // Webmaster verification tags (Google, Bing, Yandex, Pinterest, Baidu) and fb:app_id.
    ...cmsSiteMetadata(cms),
  };
}

export const viewport: Viewport = {
  themeColor: "#f4f5f6",
};

async function CmsRuntime() {
  const cms = await getCmsBootstrap("/");
  const gaId = cms?.settings.googleAnalyticsId || "";
  const gtmId = cms?.settings.googleTagManagerId || "";
  const headerScripts = cms?.settings.headerScripts || "";
  const footerScripts = cms?.settings.footerScripts || "";
  const jsonLd = cmsSiteJsonLd(cms);
  const theme = cmsTheme(cms);

  return <>
        {/* Site theme (Appearance settings): Google Font + CSS variable overrides. */}
        {theme.fontHref ? <link rel="stylesheet" href={theme.fontHref} /> : null}
        {theme.css ? <style dangerouslySetInnerHTML={{ __html: theme.css }} /> : null}


        {/* Site-wide structured data (Organization / WebSite / Software) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />

        <RuntimeScripts
          gaId={gaId} gtmId={gtmId}
          headerScripts={headerScripts} footerScripts={footerScripts}
          headerCategory={cms?.settings.headerScriptsCategory ?? "marketing"}
          footerCategory={cms?.settings.footerScriptsCategory ?? "marketing"}
          snippets={[...cmsSnippets(cms, "head"), ...cmsSnippets(cms, "body_open"), ...cmsSnippets(cms, "footer")]}
        />
  </>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${stackSansText.variable} ${ibmPlexSerif.variable}`}>
      <body>
        <Suspense fallback={null}><CmsRuntime /></Suspense>
        {children}
        {/* Announcement bars & popups (Campaigns), rendered client-side with targeting + triggers. */}
        <Campaigns />
      </body>
    </html>
  );
}
