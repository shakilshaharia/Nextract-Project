import type { MetadataRoute } from "next";
import { getCmsBootstrap } from "@/lib/cms";
import { siteUrl } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const cms = await getCmsBootstrap("/");
  // Private admin and API URLs are deliberately omitted: listing them here
  // would advertise them. Their responses carry noindex/nofollow headers.
  const disallow = (cms?.settings.robotsDisallow ?? [])
    .filter(Boolean)
    .filter((rule) => !/^\/(?:api|admin)(?:\/|$)/i.test(rule.trim()));
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
