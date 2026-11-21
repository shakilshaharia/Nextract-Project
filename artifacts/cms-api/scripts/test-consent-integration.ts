import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';
import { db } from '../src/db.ts';
import { sha256 } from '../src/lib/auth.ts';
import { invalidateContent } from '../src/lib/content.ts';

const server = createApp().listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No test server');
const base = `http://127.0.0.1:${address.port}`;
let visitorId = '';
let snippetId = '';
let authorId = '';
let sessionId = '';

async function call(method: string, path: string, body?: unknown, cookie = '', origin = '') {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), 'content-type': 'application/json', 'X-Nextract-CSRF': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) as Record<string, any> : {}, cookie: response.headers.get('set-cookie') ?? '' };
}

try {
  const first = await call('GET', '/api/public/consent');
  assert.equal(first.status, 200);
  assert.equal(first.data.consent, null);
  assert.equal((await call('POST', '/api/public/forms/custom/nonexistent/view')).status, 204);
  assert.equal((await call('POST', '/api/public/campaigns/nonexistent/event', { event: 'view' })).status, 204);
  assert.equal((await call('GET', '/api/admin/consent/records')).status, 401);

  const author = await db.user.create({ data: { email: `privacy-${randomBytes(8).toString('hex')}@example.invalid`, name: 'Consent test author', passwordHash: 'test-only', role: 'AUTHOR' } });
  authorId = author.id;
  const token = randomBytes(32).toString('base64url');
  sessionId = sha256(token);
  await db.session.create({ data: { id: sessionId, userId: authorId, expiresAt: new Date(Date.now() + 600_000) } });
  assert.equal((await call('GET', '/api/admin/consent/records', undefined, `nextract_session=${token}`)).status, 403);

  assert.equal((await call('POST', '/api/public/consent', { version: first.data.version, action: 'customize', choices: { essential: false, functional: false, analytics: false, marketing: false } })).status, 400);
  assert.equal((await call('POST', '/api/public/consent', { version: first.data.version, action: 'accept_all' }, '', 'https://evil.invalid')).status, 403);

  const saved = await call('POST', '/api/public/consent', { version: first.data.version, action: 'accept_all' });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.consent.choices.analytics, true);
  assert.match(saved.cookie, /HttpOnly/i);
  const cookie = saved.cookie.split(';')[0];
  visitorId = cookie.split('=')[1].split('.')[0];
  const read = await call('GET', '/api/public/consent', undefined, cookie);
  assert.equal(read.data.consent.choices.marketing, true);
  assert.equal((await call('POST', '/api/public/forms/custom/nonexistent/view', undefined, cookie)).status, 200);
  assert.equal((await call('POST', '/api/public/campaigns/nonexistent/event', { event: 'view' }, cookie)).status, 200);

  const snippet = await db.snippet.create({ data: { name: 'Consent test', language: 'js', code: 'window.__consentTest=1;', active: true, consentCategory: 'analytics' } });
  snippetId = snippet.id;
  invalidateContent();
  const changed = await call('GET', '/api/public/consent', undefined, cookie);
  assert.notEqual(changed.data.version, first.data.version);
  assert.equal(changed.data.consent, null);
  assert.equal((await call('POST', '/api/public/forms/custom/nonexistent/view', undefined, cookie)).status, 204);
  assert.equal((await call('POST', '/api/public/consent', { version: first.data.version, action: 'accept_all' }, cookie)).status, 400);

  const withdrawn = await call('POST', '/api/public/consent', { version: changed.data.version, action: 'withdraw' }, cookie);
  assert.equal(withdrawn.status, 201);
  assert.equal(withdrawn.data.consent.choices.analytics, false);
  const records = await db.consentRecord.findMany({ where: { visitorId }, orderBy: { createdAt: 'asc' } });
  assert.equal(records.length, 2);
  assert.equal(records[1].action, 'withdraw');
  console.log('PASS: consent validation, CSRF, permissions, history, policy re-consent, and withdrawal.');
} finally {
  if (snippetId) await db.snippet.delete({ where: { id: snippetId } });
  if (visitorId) await db.consentRecord.deleteMany({ where: { visitorId } });
  if (sessionId) await db.session.delete({ where: { id: sessionId } });
  if (authorId) await db.user.delete({ where: { id: authorId } });
  invalidateContent();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
}
