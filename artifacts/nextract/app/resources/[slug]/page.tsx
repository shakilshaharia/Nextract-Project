import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { PostLayout } from '@/components/post/PostLayout';
import { getCmsResource } from '@/lib/cms';
import { resourceToPost } from '@/lib/cms-posts';
import { getPost } from '@/lib/posts';

export const instant = false;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ previewToken?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const resource = await getCmsResource('resources', slug, previewToken);
  const post = resource ? resourceToPost(resource) : getPost('blog', slug);
  if (!post) return {};
  return { title: resource?.seo.seoTitle || `${post.title} | Nextract`, description: resource?.seo.metaDescription || post.excerpt, alternates: { canonical: `/resources/${slug}` }, ...(previewToken ? { robots: { index: false, follow: false } } : {}) };
}

export default async function ResourcePostPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ previewToken?: string }> }) {
  await connection();
  const { slug } = await params;
  const { previewToken } = await searchParams;
  const resource = await getCmsResource('resources', slug, previewToken);
  const post = resource ? resourceToPost(resource) : getPost('blog', slug);
  if (!post) notFound();
  return <PostLayout post={post} />;
}
