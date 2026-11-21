import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import { guardWrites, requestContext } from '../src/lib/request-security.ts';
import { errorHandler, clientIp } from '../src/lib/http.ts';
import { hashPassword, passwordSchema, verifyPassword } from '../src/lib/auth.ts';
import { assertSafeSvg, detectType } from '../src/lib/media.ts';
import { boundedUpload } from '../src/lib/uploads.ts';
import { csvCell } from '../src/lib/csv.ts';
import { decryptBackup, encryptBackup, isCredentialFile } from '../src/lib/backup-crypto.ts';
import { limiter } from '../src/lib/rate.ts';

test('new long passwords retain bytes after bcrypt limit and legacy hashes still verify', async () => {
  const password = 'x'.repeat(80) + 'one';
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('x'.repeat(80) + 'two', hash), false);
  assert.equal(await verifyPassword('legacy-pass-123', await bcrypt.hash('legacy-pass-123', 4)), true);
  assert.equal(passwordSchema.safeParse('correct horse battery staple').success, true);
  assert.equal(passwordSchema.safeParse('short123').success, false);
});

test('SVG parser rejects namespace script, encoded URLs, external references and XML entities', () => {
  assert.doesNotThrow(() => assertSafeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h2v2z"/></svg>')));
  for (const svg of [
    '<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>',
    '<svg><a href="&#x6a;avascript:alert(1)">test</a></svg>',
    '<svg><image href="//internal.example/a"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "hello">]><svg>&x;</svg>',
    '<svg><set attributeName="onload" to="alert(1)"/></svg>',
  ]) assert.throws(() => assertSafeSvg(Buffer.from(svg)));
  assert.equal(detectType(Buffer.from('PK\x03\x04arbitrary zip bytes'), 'renamed.docx'), null);
  assert.equal(detectType(Buffer.from('<html><script>bad()</script></html>'), 'image.png'), null);
});

test('CSV exports neutralize formulas including leading whitespace', () => {
  for (const value of ['=1+1', ' +cmd', '\t=1+1', '\n@sum(1)', '-2', '@test']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('O\'Brien, "Jane"'), '"O\'Brien, ""Jane"""');
});

test('encrypted backup round trip authenticates key and ciphertext; credential files excluded', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nx-crypto-test-'));
  try {
    const source = path.join(dir, 'source'), encrypted = path.join(dir, 'encrypted'), decoded = path.join(dir, 'decoded');
    const original = randomBytes(100_000), key = randomBytes(32).toString('hex');
    await writeFile(source, original);
    await encryptBackup(source, encrypted, key);
    assert.notDeepEqual(await readFile(encrypted), original);
    await decryptBackup(encrypted, decoded, key);
    assert.deepEqual(await readFile(decoded), original);
    await assert.rejects(decryptBackup(encrypted, path.join(dir, 'wrong-key'), randomBytes(32).toString('hex')));
    const tampered = await readFile(encrypted); tampered[100] ^= 1;
    await writeFile(path.join(dir, 'tampered'), tampered);
    await assert.rejects(decryptBackup(path.join(dir, 'tampered'), path.join(dir, 'bad-output'), key));
    for (const name of ['.env', '.env.production', '.dev-credentials', 'key.pem']) assert.equal(isCredentialFile(name), true);
    assert.equal(isCredentialFile('page.tsx'), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('HTTP CSRF, forwarding, request ID, bounded multipart and rate-limit controls', async () => {
  const app = express();
  app.use(requestContext);
  app.use(guardWrites);
  app.post('/auth/test', (_req, res) => res.json({ ok: true }));
  app.get('/ip', (req, res) => res.json({ ip: clientIp(req) }));
  app.post('/upload', boundedUpload(100, 100).array('files', 2), (_req, res) => res.json({ ok: true }));
  app.get('/limited', limiter({ windowMinutes: 1, limit: 2, message: 'test throttle' }), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const missing = await fetch(`${base}/auth/test`, { method: 'POST' });
    assert.equal(missing.status, 403);
    assert.match(missing.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
    assert.equal((await fetch(`${base}/auth/test`, { method: 'POST', headers: { 'X-Nextract-CSRF': '1' } })).status, 200);
    assert.equal((await fetch(`${base}/auth/test`, { method: 'POST', headers: { 'X-Nextract-CSRF': '1', Origin: 'https://evil.invalid', Host: 'evil.invalid' } })).status, 403);
    assert.equal((await fetch(`${base}/auth/test`, { method: 'POST', headers: { 'X-Nextract-CSRF': '1', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const identity = await fetch(`${base}/ip`, { headers: { 'CF-Connecting-IP': '1.2.3.4', 'X-Forwarded-For': '1.2.3.4' } });
    assert.equal((await identity.json() as { ip: string }).ip, '127.0.0.1');
    const form = new FormData(); form.append('files', new Blob(['a'.repeat(70)]), 'a.txt'); form.append('files', new Blob(['b'.repeat(70)]), 'b.txt');
    assert.equal((await fetch(`${base}/upload`, { method: 'POST', body: form })).status, 413);
    const small = new FormData(); small.append('files', new Blob(['ok']), 'a.txt');
    assert.equal((await fetch(`${base}/upload`, { method: 'POST', body: small })).status, 200);
    assert.equal((await fetch(`${base}/limited`)).status, 200);
    assert.equal((await fetch(`${base}/limited`)).status, 200);
    const blocked = await fetch(`${base}/limited`); assert.equal(blocked.status, 429); assert.ok(blocked.headers.get('retry-after'));
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
