import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './env.ts';
import { db } from './db.ts';
import { loadSession } from './lib/auth.ts';
import { HttpError, errorHandler } from './lib/http.ts';
import { guardWrites, isAllowedOrigin, requestContext } from './lib/request-security.ts';
import { limiter } from './lib/rate.ts';
import { PERMISSIONS_POLICY } from './lib/security.ts';
import { adminRouter } from './routes/admin.ts';
import { authRouter } from './routes/auth.ts';
import { publicRouter } from './routes/public.ts';
import { mountSite } from './site.ts';

function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  res.vary('Origin');
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nextract-CSRF, X-Upload-Offset');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
  }
  next();
}

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY ? env.TRUST_PROXY.split(',').map((value) => value.trim()) : false);
  app.disable('x-powered-by');
  app.use(requestContext);

  app.use(
    helmet({
      // The Content-Security-Policy is set per response (site.ts / the admin
      // handler) because public pages carry a fresh script nonce each time;
      // helmet still supplies the static headers below.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      // One year, apply to subdomains. Only emitted on https responses.
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  // helmet has no Permissions-Policy; set the one the whole site shares.
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  app.use(cookieParser());

  const api = express.Router();
  // API routes must stay reachable by the site, but they are not documents
  // and must never be indexed, cached in search results or used for snippets.
  api.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
    next();
  });
  api.use(cors);
  api.use(guardWrites);
  const apiLimiter = limiter({ windowMinutes: 1, limit: 600, message: 'Too many API requests. Please wait and try again.' });
  api.use((req, res, next) => req.path === '/health' ? next() : apiLimiter(req, res, next));
  api.use(express.json({ limit: '4mb' }));
  api.use(loadSession);
  // Admin and auth responses must never be cached by a browser or CDN.
  api.use((req, res, next) => {
    if (!req.path.startsWith('/public/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ ok: true, status: 'ready', db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, status: 'unavailable', db: 'down', time: new Date().toISOString() });
    }
  });
  api.use('/auth', authRouter);
  api.use('/public', publicRouter);
  api.use('/admin', adminRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'No such API endpoint.', 'not_found')));
  api.use(errorHandler);

  app.use('/api', api);
  mountSite(app);
  app.use(errorHandler);
  return app;
}
