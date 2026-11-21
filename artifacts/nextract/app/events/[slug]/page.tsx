import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayout } from "@/components/post/PostLayout";
import { getPost, getPostsByType } from "@/lib/posts";
import { getCmsResource } from "@/lib/cms";
import { resourceToPost } from "@/lib/cms-posts";
import { connection } from "next/server";

// Content detail page: the whole page is the post, so blocking navigation is fine.
export const instant = false;

export function generateStaticParams() {
  return getPostsByType("event").map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewToken?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const resource = await getCmsResource("events", slug, previewToken);
  const post = resource ? resourceToPost(resource) : getPost("event", slug);
  if (!post) return {};
  return {
    title: `${post.title} | Nextract Events`,
    description: post.excerpt,
    alternates: { canonical: `/events/${post.slug}` },
    ...(previewToken ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function EventPostPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ previewToken?: string }> }) {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  await connection();
  const resource = await getCmsResource("events", slug, previewToken);
  const post = resource ? resourceToPost(resource) : getPost("event", slug);
  if (!post) notFound();
  return <PostLayout post={post} />;
}
