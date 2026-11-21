// Active testing is restricted to an approved local development DB. Only rows
// created by this script are modified/deleted; no existing account is used.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.ts';
import { db } from '../src/db.ts';
import { env } from '../src/env.ts';
import { hashPassword, mfaDigest, sha256, signMfaChallenge } from '../src/lib/auth.ts';
import { encryptSecret, generateTotpSecret } from '../src/lib/totp.ts';
import { closeRateStore } from '../src/lib/rate.ts';

assert.notEqual(env.NODE_ENV, 'production', 'Do not run active security tests against production.');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(env.DATABASE_URL).hostname), 'Use a local development database.');
const suffix = randomBytes(8).toString('hex'), password = randomBytes(24).toString('base64url');
const ids: string[] = [], posts: string[] = [];
const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
async function call(method: string, route: string, cookie = '', body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { 'X-Nextract-CSRF': '1', ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: (text ? JSON.parse(text) : {}) as Record<string, any>, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
async function user(role: 'AUTHOR' | 'EDITOR' | 'SUPER_ADMIN') {
  const record = await db.user.create({ data: { email: `security-${ids.length}-${suffix}@example.invalid`, name: 'Isolated security test', role, passwordHash: await hashPassword(password) } });
  ids.push(record.id); return record;
}
async function session(userId: string, createdAt = new Date(), lastSeenAt = new Date()) {
  const token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { id: sha256(token), userId, createdAt, lastSeenAt, expiresAt: new Date(Date.now() + 600_000) } });
  return { cookie: `nextract_session=${token}`, id: sha256(token) };
}

try {
  const author = await user('AUTHOR'), other = await user('AUTHOR'), editor = await user('EDITOR'), admin = await user('SUPER_ADMIN');
  const authorSession = await session(author.id), otherSession = await session(other.id), editorSession = await session(editor.id);
  const draft = await db.post.create({ data: { slug: `security-${suffix}`, title: 'Private draft', authorId: author.id, contentHtml: '<p>Private draft body</p>', contentJson: {}, relatedIds: [], seo: {}, type: 'BLOG', status: 'DRAFT' } }); posts.push(draft.id);
  assert.equal((await call('GET', '/api/admin/pages')).status, 401);
  assert.equal((await call('GET', '/api/admin/users', authorSession.cookie)).status, 403);
  assert.equal((await call('GET', '/api/admin/backups', authorSession.cookie)).status, 403);
  assert.equal((await call('GET', `/api/admin/posts/${draft.id}`, otherSession.cookie)).status, 403);
  assert.equal((await call('PATCH', `/api/admin/posts/${draft.id}`, otherSession.cookie, { title: 'stolen' })).status, 403);
  assert.equal((await call('POST', `/api/admin/posts/${draft.id}/publish`, authorSession.cookie)).status, 403);
  assert.equal((await call('PATCH', `/api/admin/posts/${draft.id}`, authorSession.cookie, { authorId: other.id })).status, 403);
  const preview = `/api/public/resources/resources/${draft.slug}?preview=1`;
  assert.equal((await call('GET', preview)).status, 404);
  assert.equal((await call('GET', preview, otherSession.cookie)).status, 404);
  assert.equal((await call('GET', preview, authorSession.cookie)).status, 200);
  assert.equal((await call('GET', preview, editorSession.cookie)).status, 200);
  const tokenPreview = await call('POST', `/api/admin/posts/${draft.id}/preview`, authorSession.cookie);
  const token = new URL(tokenPreview.data.previewUrl).searchParams.get('previewToken');
  assert.equal((await call('GET', `/api/public/resources/resources/${draft.slug}?previewToken=${token}`)).status, 200);

  // A stale authenticated session cannot administer accounts or export backups.
  const stale = await session(admin.id, new Date(Date.now() - 16 * 60_000));
  const reauth = await call('POST', '/api/admin/users', stale.cookie, {});
  assert.equal(reauth.status, 403); assert.equal(reauth.data.error.code, 'reauth_required');
  const signedIn = await call('POST', '/api/auth/login', stale.cookie, { email: admin.email, password });
  assert.equal(signedIn.status, 200); assert.ok(signedIn.cookie);
  assert.match(signedIn.headers.get('set-cookie')!, /HttpOnly/); assert.match(signedIn.headers.get('set-cookie')!, /SameSite=Lax/);
  assert.equal(await db.session.findUnique({ where: { id: stale.id } }), null);
  assert.equal((await call('GET', '/api/auth/recent', signedIn.cookie)).status, 200);
  const exposed = await call('GET', '/api/admin/users', signedIn.cookie);
  const serialized = JSON.stringify(exposed.data);
  for (const field of ['passwordHash', 'totpSecret', 'backupCodes', 'emailOtpCodeHash']) assert.ok(!serialized.includes(`"${field}"`));
  assert.equal((await call('POST', '/api/auth/logout', signedIn.cookie, undefined, { 'X-Nextract-CSRF': '' })).status, 403);
  assert.equal((await call('POST', '/api/auth/logout', signedIn.cookie)).status, 200);
  assert.equal((await call('GET', '/api/auth/me', signedIn.cookie)).status, 401);

  const idle = await session(other.id, new Date(), new Date(Date.now() - (env.SESSION_IDLE_MINUTES + 1) * 60_000));
  assert.equal((await call('GET', '/api/auth/me', idle.cookie)).status, 401);
  const expired = await session(other.id);
  await db.session.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await call('GET', '/api/auth/me', expired.cookie)).status, 401);

  // Two simultaneous requests may not both spend the same reset credential.
  const resetToken = randomBytes(32).toString('base64url'), newPassword = randomBytes(24).toString('base64url');
  await db.passwordResetToken.create({ data: { tokenHash: sha256(resetToken), userId: other.id, expiresAt: new Date(Date.now() + 60_000) } });
  const reset = await Promise.all([call('POST', '/api/auth/reset-password', '', { token: resetToken, password: newPassword }), call('POST', '/api/auth/reset-password', '', { token: resetToken, password: newPassword })]);
  assert.deepEqual(reset.map((r) => r.status).sort(), [200, 400]);
  assert.equal((await call('GET', '/api/auth/me', otherSession.cookie)).status, 401);

  const current = await session(admin.id), another = await session(admin.id);
  const changed = await call('POST', '/api/admin/profile/password', current.cookie, { currentPassword: password, newPassword });
  assert.equal(changed.status, 200); assert.ok(changed.cookie);
  assert.equal((await call('GET', '/api/auth/me', current.cookie)).status, 401);
  assert.equal((await call('GET', '/api/auth/me', another.cookie)).status, 401);
  assert.equal((await call('GET', '/api/auth/me', changed.cookie)).status, 200);

  // Recovery codes and challenges are independently single-use under races.
  const mfa = await user('SUPER_ADMIN');
  const recovery = 'abcde-12345';
  await db.user.update({ where: { id: mfa.id }, data: { totpEnabledAt: new Date(), totpSecret: encryptSecret(generateTotpSecret()), backupCodes: [{ code: sha256(recovery), usedAt: null }] } });
  const challenge1 = await signMfaChallenge(mfa.id), challenge2 = await signMfaChallenge(mfa.id);
  const results = await Promise.all([call('POST', '/api/auth/login/totp', '', { challenge: challenge1, code: recovery }), call('POST', '/api/auth/login/totp', '', { challenge: challenge2, code: recovery })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
  const usedChallenge = results[0].status === 200 ? challenge1 : challenge2;
  assert.equal((await call('POST', '/api/auth/login/totp', '', { challenge: usedChallenge, code: recovery })).status, 400);
  const unused = results[0].status === 200 ? challenge2 : challenge1;
  assert.equal((await call('POST', '/api/auth/reset-password', '', { token: unused, password })).status, 400, 'MFA challenge must not reset a password');
  const record = await db.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: mfaDigest(unused) } });
  await db.passwordResetToken.update({ where: { id: record.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await call('POST', '/api/auth/login/resend', '', { challenge: unused })).status, 400);

  // Shared account lockout stops guesses even across separate challenges.
  await db.user.update({ where: { id: mfa.id }, data: { failedLogins: 4, lockedUntil: null } });
  const lockedChallenge = await signMfaChallenge(mfa.id);
  assert.equal((await call('POST', '/api/auth/login/totp', '', { challenge: lockedChallenge, code: 'not-a-code' })).status, 401);
  const locked = await db.user.findUniqueOrThrow({ where: { id: mfa.id } }); assert.ok(locked.lockedUntil && locked.lockedUntil > new Date());
  const lockedLogin = await call('POST', '/api/auth/login', '', { email: mfa.email, password });
  const unknownLogin = await call('POST', '/api/auth/login', '', { email: `missing-${suffix}@example.invalid`, password });
  assert.equal(lockedLogin.status, unknownLogin.status); assert.deepEqual(lockedLogin.data, unknownLogin.data);

  const emailUser = await user('SUPER_ADMIN'), emailCode = '765432';
  await db.user.update({ where: { id: emailUser.id }, data: { emailOtpEnabled: true, emailOtpCodeHash: sha256(emailCode), emailOtpExpiresAt: new Date(Date.now() + 60_000), emailOtpAttempts: 0 } });
  const emailChallenges = await Promise.all([signMfaChallenge(emailUser.id), signMfaChallenge(emailUser.id)]);
  const emailResults = await Promise.all(emailChallenges.map((challenge) => call('POST', '/api/auth/login/totp', '', { challenge, code: emailCode })));
  assert.deepEqual(emailResults.map((r) => r.status).sort(), [200, 401], 'An email OTP must be consumed atomically across challenges');
  console.log('PASS: authentication, CSRF, role/ownership isolation, preview scope, reauthentication, rotation, expiry, logout/reset revocation, concurrent reset/recovery use, MFA challenge expiry and account lockout, safe user responses.');
} finally {
  await db.post.deleteMany({ where: { id: { in: posts } } });
  await db.activityLog.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRateStore(); await db.$disconnect();
}
