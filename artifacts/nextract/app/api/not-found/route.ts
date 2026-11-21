// Forwards 404 reports from the not-found page to the CMS 404 monitor
// (server-side, so the browser's origin never has to match the CMS's).
import { forwardPublicPost } from '@/lib/public-proxy';

export function POST(request: Request) { return forwardPublicPost(request, '/not-found'); }
