import { forwardPublicPost } from '@/lib/public-proxy';

export function POST(request: Request) { return forwardPublicPost(request, '/subscribe'); }
