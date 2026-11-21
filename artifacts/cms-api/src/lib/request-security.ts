import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.ts';
import { HttpError } from './http.ts';

declare global {
  namespace Express {
    interface Request { requestId?: string }
  }
}

const origins = new Set([env.siteUrl, env.adminUrl, ...env.corsOrigins].map((value) => new URL(value).origin));
export const isAllowedOrigin = (value: string) => origins.has(value);
const logWindows = new Map<string, { at: number; count: number }>();

// Never log bodies, query strings, credentials, cookies or arbitrary headers.
export function securityEvent(req: Request, event: string) {
  let window = logWindows.get(event);
  if (!window || Date.now() - window.at >= 60_000) { window = { at: Date.now(), count: 0 }; logWindows.set(event, window); }
  if (++window.count > 20) return; // bound log volume under automated abuse
  console.info(JSON.stringify({ kind: 'security', event, requestId: req.requestId, userId: req.user?.id, method: req.method, route: typeof req.route?.path === 'string' ? req.route.path : undefined }));
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.on('finish', () => {
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) securityEvent(req, `http_${res.statusCode}`);
  });
  next();
}

// A non-simple header cannot be added by a cross-origin form. Cross-origin JS
// must pass our strict CORS preflight. This protects JSON AND multipart writes,
// including clients which omit Origin. SameSite remains defense in depth only.
export function guardWrites(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return next(new HttpError(403, 'Request origin is not allowed.', 'bad_origin'));
  if (!/^\/(?:admin|auth)(?:\/|$)/.test(req.path)) return next();
  if (req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-nextract-csrf'] !== '1') {
    return next(new HttpError(403, 'Refresh the admin page and try again.', 'csrf'));
  }
  next();
}
