import { NextResponse, type NextRequest } from "next/server";

// Applies the CMS's URL redirects and maintenance mode to the public site.
// It fails open: if the routing config can't be fetched, pages serve normally
// so a CMS hiccup never takes the site down.

const apiUrl = (process.env.CMS_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

type Routing = {
  maintenance: boolean;
  maintenanceMessage: string;
  redirects: { fromPath: string; toPath: string; statusCode: number }[];
};

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

// Small in-memory cache so the config is fetched at most once every 30s per
// server instance rather than on every request.
let cache: { at: number; data: Routing | null } | null = null;
const TTL_MS = 30_000;

async function getRouting(): Promise<Routing | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const response = await fetch(`${apiUrl}/api/public/routing`, { signal: AbortSignal.timeout(2000) });
    const data = response.ok ? ((await response.json()) as Routing) : null;
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Keep serving the last known config (or nothing) rather than failing.
    cache = { at: Date.now(), data: cache?.data ?? null };
    return cache?.data ?? null;
  }
}

// Next 16 "proxy" (formerly middleware).
export async function proxy(request: NextRequest) {
  const routing = await getRouting();
  if (!routing) return NextResponse.next();

  const path = normalize(request.nextUrl.pathname);

  // URL redirects managed in the admin (including those created from the 404 monitor).
  const match = routing.redirects.find((redirect) => normalize(redirect.fromPath) === path);
  if (match) {
    const destination = /^https?:\/\//i.test(match.toPath) ? match.toPath : new URL(match.toPath, request.url).toString();
    const status = [301, 302, 307, 308].includes(match.statusCode) ? match.statusCode : 308;
    return NextResponse.redirect(destination, status);
  }

  // Maintenance mode: a 503 so crawlers know to come back, with the editor's message.
  if (routing.maintenance) {
    return new NextResponse(maintenanceHtml(routing.maintenanceMessage), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "retry-after": "3600" },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Run on public pages only — never on the API, the admin, Next internals, or static assets.
  matcher: ["/((?!api|admin|_next|uploads|favicon.ico|icon.svg|robots.txt|sitemap.xml|images|animations|fonts).*)"],
};

function maintenanceHtml(message: string) {
  const safe = (message || "We’re making a few improvements and will be back shortly.").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>We’ll be right back</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,system-ui,Arial,sans-serif;background:#f5f5fa;color:#111114}main{max-width:420px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{margin:0;line-height:1.6;color:#54545c}@media(prefers-color-scheme:dark){body{background:#0e0e12;color:#f4f4f6}p{color:#a1a1ab}}</style></head><body><main><h1>We’ll be right back</h1><p>${safe}</p></main></body></html>`;
}
