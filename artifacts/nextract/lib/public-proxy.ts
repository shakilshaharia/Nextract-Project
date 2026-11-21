const cmsApi = (process.env.CMS_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const MAX_BYTES = 64 * 1024;

export async function boundedBody(request: Request, maxBytes = MAX_BYTES): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new RangeError('Request too large');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const deadline = Date.now() + 10_000;
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), Math.max(1, deadline - Date.now())); }),
      ]).finally(() => clearTimeout(timer));
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) throw new RangeError('Request too large');
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

// Only fixed, application-owned paths may be passed by route handlers.
export async function forwardPublicPost(request: Request, path: string) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    return Response.json({ error: { message: 'Send JSON content.', code: 'content_type' } }, { status: 415 });
  }
  let body: Uint8Array;
  try { body = await boundedBody(request); }
  catch (error) { return Response.json({ error: { message: error instanceof RangeError ? 'The request is too large.' : 'The request timed out.', code: 'invalid' } }, { status: error instanceof RangeError ? 413 : 408 }); }
  try {
    const response = await fetch(`${cmsApi}/api/public${path}`, {
      method: 'POST', body: body as BodyInit, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: {
        'content-type': 'application/json',
        // Trusted only with explicit API proxy trust AND an ingress that
        // overwrites the externally supplied forwarding header.
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
        'user-agent': (request.headers.get('user-agent') ?? '').slice(0, 300),
      },
    });
    const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
    for (const name of ['retry-after', 'ratelimit', 'ratelimit-policy', 'x-request-id']) {
      const value = response.headers.get(name); if (value) headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json({ message: 'The service is temporarily unavailable.' }, { status: 503 });
  }
}
