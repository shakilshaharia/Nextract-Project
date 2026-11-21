const cmsApi = (process.env.CMS_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: Context, method: "GET" | "HEAD") {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    return new Response(null, { status: 400 });
  }

  const upstreamUrl = `${cmsApi}/uploads/${path.map(encodeURIComponent).join("/")}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      cache: "no-store",
      headers: request.headers.get("range") ? { Range: request.headers.get("range")! } : undefined,
      redirect: "manual",
    });
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified", "cache-control", "content-security-policy", "content-disposition", "x-frame-options", "referrer-policy"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}

export function GET(request: Request, context: Context) {
  return proxy(request, context, "GET");
}

export function HEAD(request: Request, context: Context) {
  return proxy(request, context, "HEAD");
}
