import type { NextConfig } from "next";

// Security headers for the public pages Next serves directly (in production
// `next start` answers visitors itself; cms-api's helmet only covers /admin and
// the API). Mirrors cms-api's policy. The CSP restricts framing, <base> and
// plugins only — not scripts/styles — so GA/GTM, Code Snippets and HTML widgets
// keep working. Fullscreen/autoplay keep browser defaults so YouTube/Vimeo
// embeds work. HSTS is ignored by browsers on plain http (local dev).
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), display-capture=(), browsing-topics=()",
  },
];

const apiIndexingHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Set by `next upgrade --agent=security` (16.4.0 → 16.4.3).
    agentUpgrade: "security",
  },
  images: {
    // 90 is used for illustrations that contain small UI text.
    qualities: [75, 90],
    formats: ["image/avif", "image/webp"],
  },
  // Proxy the CMS admin panel and its API to the cms-api process (:4000) so the
  // whole site stays on one origin with no extra nginx config. The public site
  // fetches /api/public server-side directly; /api/forms stays a Next route.
  async headers() {
    // Everything except paths proxied to cms-api, which sets its own (helmet).
    return [
      // Covers Next-native API routes. Rewritten CMS API routes set the same
      // header in cms-api so no API response can become a search result.
      { source: "/api/:path*", headers: apiIndexingHeaders },
      { source: "/:path((?!admin|api/admin|api/auth|api/public|uploads).*)", headers: securityHeaders },
      { source: "/uploads/:path*", headers: [
        { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ] },
      // Observe restrictions before enforcing: snippets and Next hydration
      // intentionally include inline JavaScript. No samples are collected.
      { source: "/:path((?!admin|api|uploads|_next).*)", headers: [
        { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' blob: https:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'" },
      ] },
    ];
  },
  async rewrites() {
    const cms = (process.env.CMS_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
    return [
      // Trailing slash on the destination so cms-api serves the SPA directly
      // instead of issuing its own /admin -> /admin/ redirect (avoids a loop).
      { source: "/admin", destination: `${cms}/admin/` },
      { source: "/admin/:path*", destination: `${cms}/admin/:path*` },
      { source: "/api/auth/:path*", destination: `${cms}/api/auth/:path*` },
      { source: "/api/admin/:path*", destination: `${cms}/api/admin/:path*` },
      { source: "/api/public/:path*", destination: `${cms}/api/public/:path*` },
    ];
  },
};

export default nextConfig;
