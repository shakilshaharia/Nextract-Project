// Exercise mandatory enrollment and lost-device recovery with disposable users.
// No existing user's factors, credentials, settings or sessions are changed.
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';

assert.notEqual(process.env.NODE_ENV, 'production');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname));
process.env.REQUIRE_ADMIN_MFA = 'true';
const { createApp } = await import('../src/app.ts');
const { db } = await import('../src/db.ts');
const { hashPassword, sha256 } = await import('../src/lib/auth.ts');
const { closeRateStore } = await import('../src/lib/rate.ts');
const users: string[] = [], password = randomBytes(24).toString('base64url');
const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
type Account = { id: string; email: string };
async function account() {
  const user = await db.user.create({ data: { email: `mfa-rollout-${randomBytes(8).toString('hex')}@example.invalid`, name: 'Isolated MFA rollout', passwordHash: await hashPassword(password), role: 'SUPER_ADMIN' } });
  users.push(user.id);
  // Register a known local test device so login does not trigger any email.
  await db.session.create({ data: { id: sha256(randomBytes(32).toString('hex')), userId: user.id, ip: '127.0.0.1', expiresAt: new Date(Date.now() + 600_000) } });
  return user;
}
async function call(method: string, route: string, cookie = '', body?: unknown) {
  const response = await fetch(`${base}${route}`, { method, headers: { 'X-Nextract-CSRF': '1', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '', data: await response.json() as Record<string, any> };
}
function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, value = 0; const bytes: number[] = [];
  for (const ch of secret) { value = (value << 5) | alphabet.indexOf(ch); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
async function enroll(user: Account) {
  const login = await call('POST', '/api/auth/login', '', { email: user.email, password });
  assert.equal(login.status, 200); assert.equal(login.data.twoFactorRequired, true);
  assert.ok(login.cookie);
  const blocked = await call('GET', '/api/admin/dashboard', login.cookie);
  assert.equal(blocked.status, 403); assert.equal(blocked.data.error.code, 'mfa_enrollment_required');
  assert.equal((await call('GET', '/api/admin/profile', login.cookie)).status, 200);
  const setup = await call('POST', '/api/admin/profile/2fa/setup', login.cookie);
  assert.equal(setup.status, 200); assert.ok(setup.data.qr && setup.data.secret);
  const enabled = await call('POST', '/api/admin/profile/2fa/enable', login.cookie, { password, code: totp(setup.data.secret) });
  assert.equal(enabled.status, 200); assert.equal(enabled.data.backupCodes.length, 10);
  assert.equal((await call('GET', '/api/admin/dashboard', login.cookie)).status, 200);
  assert.equal((await call('POST', '/api/admin/profile/2fa/disable', login.cookie, { password })).status, 403);
  return { cookie: login.cookie, codes: enabled.data.backupCodes as string[] };
}
async function recoveryLogin(user: Account, code: string) {
  const login = await call('POST', '/api/auth/login', '', { email: user.email, password });
  assert.equal(login.data.mfaRequired, true); assert.equal(login.cookie, '');
  return call('POST', '/api/auth/login/totp', '', { challenge: login.data.challenge, code });
}

try {
  const primary = await account(), spare = await account();
  const enrolled = await enroll(primary), spareEnrollment = await enroll(spare);
  const recovered = await recoveryLogin(primary, enrolled.codes[0]);
  assert.equal(recovered.status, 200); assert.ok(recovered.cookie);
  assert.equal((await recoveryLogin(primary, enrolled.codes[0])).status, 401, 'Recovery codes are single use');
  const regenerated = await call('POST', '/api/admin/profile/2fa/backup-codes', recovered.cookie, { password });
  assert.equal(regenerated.status, 200);
  assert.equal((await recoveryLogin(primary, enrolled.codes[1])).status, 401, 'Regenerating codes invalidates the old unused set');
  assert.equal((await recoveryLogin(primary, regenerated.data.backupCodes[0])).status, 200);
  const spareLogin = await recoveryLogin(spare, spareEnrollment.codes[0]); assert.equal(spareLogin.status, 200);
  const reset = await call('POST', `/api/admin/users/${primary.id}/reset-2fa`, spareLogin.cookie);
  assert.equal(reset.status, 200);
  assert.equal((await call('GET', '/api/auth/me', recovered.cookie)).status, 401);
  const reenrolled = await enroll(primary);
  assert.equal((await recoveryLogin(primary, reenrolled.codes[0])).status, 200);
  console.log('PASS: required MFA enrollment, TOTP confirmation, backup-code recovery/single use/regeneration, verified spare administrator recovery, session revocation, and safe reenrollment. Existing accounts unchanged.');
} finally {
  await db.activityLog.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeRateStore(); await db.$disconnect();
}
