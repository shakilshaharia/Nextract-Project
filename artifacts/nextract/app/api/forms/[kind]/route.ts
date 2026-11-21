import { forwardPublicPost } from '@/lib/public-proxy';

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== 'contact' && kind !== 'demo') return Response.json({ message: 'Unknown form.' }, { status: 404 });
  return forwardPublicPost(request, `/forms/${kind}`);
}
