import { forwardPublicPost } from '@/lib/public-proxy';

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) return Response.json({ message: 'Unknown form.' }, { status: 404 });
  return forwardPublicPost(request, `/forms/custom/${encodeURIComponent(slug)}`);
}
