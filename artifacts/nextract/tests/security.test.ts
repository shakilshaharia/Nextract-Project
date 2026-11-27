import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundedBody, forwardPublicPost } from '../lib/public-proxy';
import { getCmsBootstrap, getCmsResource, getCmsResources, managedContent } from '../lib/cms';
import nextConfig from '../next.config';

test('managed section edits merge typed values with existing content', () => {
  const cms = { page: { sections: [{
    id: 'example', type: 'managed', key: 'example', visible: true, contentJson: JSON.stringify({
      heading: 'Edited title', media: { mode: 'video' }, enabled: false, count: 0,
    }),
  }] } };
  const defaults = { heading: 'Default title', media: { mode: 'original', video: '' }, enabled: true, count: 1 };
  assert.deepEqual(managedContent(cms, 'example', defaults), {
    heading: 'Edited title', media: { mode: 'video', video: '' }, enabled: false, count: 0,
  });
});

test('all Next API routes carry a search-engine noindex header', async () => {
  const rules = await nextConfig.headers?.();
  const apiRule = rules?.find((rule) => rule.source === '/api/:path*');
  assert.ok(apiRule);
  assert.match(apiRule.headers.find((header) => header.key.toLowerCase() === 'x-robots-tag')?.value ?? '', /noindex.*nofollow.*noarchive/);
});

test('public proxy rejects large declared and chunked bodies before forwarding', async () => {
  const tooLarge = new Request('http://localhost/api/forms/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '999999' }, body: '{}' });
  assert.equal((await forwardPublicPost(tooLarge, '/forms/contact')).status, 413);
  const chunked = new Request('http://localhost', { method: 'POST', body: 'x'.repeat(65537) });
  await assert.rejects(boundedBody(chunked), RangeError);
  assert.equal(new TextDecoder().decode(await boundedBody(new Request('http://localhost', { method: 'POST', body: '{}' }))), '{}');
  assert.equal((await forwardPublicPost(new Request('http://localhost', { method: 'POST', body: 'text' }), '/subscribe')).status, 415);
});

test('CMS fetch failures preserve bundled content helpers; public forwarding strips browser credentials', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('simulated unavailable CMS'); };
    assert.equal(await getCmsBootstrap('/'), null);
    assert.equal(await getCmsResources(), null);
    assert.equal(await getCmsResource('events', 'test-event'), null);
    const fallback = { heading: 'Bundled content' };
    assert.equal(managedContent(null, 'hero', fallback), fallback);
    let forwarded: RequestInit | undefined;
    globalThis.fetch = async (_url, options) => { forwarded = options; return Response.json({ ok: true }); };
    const response = await forwardPublicPost(new Request('http://localhost/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'private=value', authorization: 'Bearer private' }, body: '{}' }), '/subscribe');
    assert.equal(response.status, 200);
    assert.equal(new Headers(forwarded?.headers).has('cookie'), false);
    assert.equal(new Headers(forwarded?.headers).has('authorization'), false);
    assert.equal(forwarded?.redirect, 'error');
    assert.ok(forwarded?.signal);

    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.equal(await getCmsResource('events', 'test-event'), undefined);
  } finally { globalThis.fetch = originalFetch; }
});
