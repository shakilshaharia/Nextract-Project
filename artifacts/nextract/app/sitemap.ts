import type { MetadataRoute } from "next";
import { getCmsResources } from "@/lib/cms";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages = ["", "/about", "/contact", "/partnership", "/pricing", "/resources", "/privacy-policy", "/terms-and-conditions"];
  const resources = (await getCmsResources()) ?? [];
  return [
    ...staticPages.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: path ? "monthly" as const : "weekly" as const,
      priority: path === "" ? 1 : path === "/resources" ? 0.8 : 0.7,
    })),
    ...resources.map((resource) => ({
      url: `${siteUrl}${resource.path}`,
      lastModified: new Date(resource.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
      images: resource.cover?.src ? [new URL(resource.cover.src, siteUrl).href] : undefined,
    })),
  ];
}
