import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { defaultSecuritySettings } from '@workspace/cms-content';
import { createApp } from '../src/app.ts';
import { db } from '../src/db.ts';
import { env } from '../src/env.ts';
import type { Prisma } from '../src/generated/prisma/client.ts';
import { hashPassword, sha256 } from '../src/lib/auth.ts';
import { closeRateStore } from '../src/lib/rate.ts';

assert.notEqual(env.NODE_ENV, 'production', 'Do not run active login tests against production.');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.DATABASE_URL).hostname), 'Use a local development database.');
const originalSetting = await db.setting.findUnique({ where: { key: 'security' } });
const password = randomBytes(24).toString('base64url');
const suffix = randomBytes(8).toString('hex');
const user = await db.user.create({ data: { email: `login-security-${suffix}@example.invalid`, name: 'Login security test', role: 'SUPER_ADMIN', passwordHash: await hashPassword(password) } });
await db.setting.upsert({ where: { key: 'security' }, update: { value: defaultSecuritySettings }, create: { key: 'security', value: defaultSecuritySettings } });
const token = randomBytes(32).toString('base64url');
await db.session.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 600_000) } });
const cookie = `nextract_session=${token}`;
const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
const realFetch = globalThis.fetch;

async function call(method: string, route: string, options: { cookie?: string; body?: unknown; redirect?: 'follow' | 'error' | 'manual' } = {}) {
  const response = await realFetch(`${base}${route}`, {
    method,
    redirect: options.redirect ?? 'follow',
    headers: { 'X-Nextract-CSRF': '1', ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  let data: Record<string, any> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* HTML/plain response */ }
  return { response, text, data };
}

try {
  const security = { ...defaultSecuritySettings, adminPath: `secure-${suffix}`, loginRecaptchaEnabled: true, loginRecaptchaSiteKey: 'public-test-key', loginRecaptchaSecret: 'private-test-secret' };
  const saved = await call('PUT', '/api/admin/settings/security', { cookie, body: security });
  assert.equal(saved.response.status, 200, saved.text);
  assert.equal(saved.data.security.loginRecaptchaSecret, '');
  assert.equal(saved.data.security.hasLoginRecaptchaSecret, true);
  assert.ok(!saved.text.includes('private-test-secret'));
  const storedSecurity = await db.setting.findUniqueOrThrow({ where: { key: 'security' } });
  assert.ok(!JSON.stringify(storedSecurity.value).includes('private-test-secret'));
  assert.match(String((storedSecurity.value as { loginRecaptchaSecret: string }).loginRecaptchaSecret), /^sealed:v1:/);

  const settings = await call('GET', '/api/admin/settings', { cookie });
  assert.equal(settings.response.status, 200);
  assert.ok(!settings.text.includes('private-test-secret'));
  const dashboard = await call('GET', '/api/admin/dashboard', { cookie });
  assert.equal(dashboard.response.status, 200, dashboard.text);
  assert.ok(Array.isArray(dashboard.data.activeMembers));
  assert.ok(dashboard.data.activeMembers.some((member: { id: string; isCurrentUser: boolean }) => member.id === user.id && member.isCurrentUser));
  assert.ok(!dashboard.text.includes('userAgent'));
  assert.ok(!dashboard.text.includes('127.0.0.1'));
  const config = await call('GET', '/api/auth/config');
  assert.deepEqual(config.data, { recaptchaEnabled: true, recaptchaSiteKey: 'public-test-key' });
  assert.match(config.response.headers.get('x-robots-tag') ?? '', /noindex.*nofollow.*noarchive/);

  const oldAnonymous = await call('GET', '/admin', { redirect: 'manual' });
  assert.equal(oldAnonymous.response.status, 404);
  const oldAuthenticated = await call('GET', '/admin', { cookie, redirect: 'manual' });
  assert.equal(oldAuthenticated.response.status, 302);
  assert.equal(oldAuthenticated.response.headers.get('location'), `/admin/${security.adminPath}`);
  const privatePage = await call('GET', `/admin/${security.adminPath}/login`);
  assert.equal(privatePage.response.status, 200);
  assert.match(privatePage.response.headers.get('x-robots-tag') ?? '', /noindex.*nofollow.*noarchive/);
  assert.match(privatePage.response.headers.get('content-security-policy') ?? '', /google\.com\/recaptcha/);
  assert.match(privatePage.text, new RegExp(`name="cms-admin-base" content="/admin/${security.adminPath}"`));
  assert.match(privatePage.text, /name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"/);

  const robots = await call('GET', '/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.ok(!robots.text.includes('/admin'));
  assert.ok(!robots.text.includes('/api'));
  assert.ok(!robots.text.includes(security.adminPath));

  const missingCaptcha = await call('POST', '/api/auth/login', { body: { email: user.email, password } });
  assert.equal(missingCaptcha.response.status, 400);
  assert.equal(missingCaptcha.data.error.code, 'captcha');

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === 'https://www.google.com/recaptcha/api/siteverify') {
      return Promise.resolve(new Response(JSON.stringify({ success: true, hostname: new URL(env.siteUrl).hostname }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(input, init);
  }) as typeof fetch;
  const signedIn = await call('POST', '/api/auth/login', { body: { email: user.email, password, recaptchaToken: 'valid-test-token' } });
  assert.equal(signedIn.response.status, 200, signedIn.text);
  assert.ok(signedIn.response.headers.get('set-cookie'));
  console.log('PASS: active-member presence, private admin URL, anonymous legacy 404, noindex/robots hiding, write-only CAPTCHA secret, public config and server-side CAPTCHA enforcement.');
} finally {
  globalThis.fetch = realFetch;
  await db.activityLog.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  if (originalSetting) await db.setting.update({ where: { key: 'security' }, data: { value: originalSetting.value as Prisma.InputJsonValue, updatedById: originalSetting.updatedById } });
  else await db.setting.deleteMany({ where: { key: 'security' } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRateStore(); await db.$disconnect();
}
