import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env.ts';

type PreviewKind = 'post' | 'page';
export type PreviewClaims = { kind: PreviewKind; id: string; expiresAt: number };

function signature(payload: string) {
  return createHmac('sha256', env.APP_SECRET).update(`preview:${payload}`).digest('base64url');
}

// Preview URLs are deliberately short-lived and carry no session cookie. This
// lets the separately hosted Next.js site render a saved draft without making
// any draft API generally public.
export function issuePreviewToken(kind: PreviewKind, id: string, lifetimeSeconds = 10 * 60) {
  const payload = Buffer.from(JSON.stringify({ kind, id, expiresAt: Math.floor(Date.now() / 1000) + lifetimeSeconds })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyPreviewToken(token: string | undefined): PreviewClaims | null {
  if (!token || token.length > 1500) return null;
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<PreviewClaims>;
    if ((claims.kind !== 'post' && claims.kind !== 'page') || typeof claims.id !== 'string' || !claims.id || typeof claims.expiresAt !== 'number') return null;
    if (claims.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return claims as PreviewClaims;
  } catch {
    return null;
  }
}
