// Full application DB + file restore, restricted to a NEW disposable database.
// Copies schema only from the local development DB; no real content is copied.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

assert.notEqual(process.env.NODE_ENV, 'production', 'Recovery tests must not run in production.');
const original = new URL(process.env.DATABASE_URL!);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(original.hostname), 'Only the approved local DB is allowed.');
const name = `nextract_recovery_${randomBytes(8).toString('hex')}`;
assert.match(name, /^nextract_recovery_[a-f0-9]{16}$/);
assert.notEqual(original.pathname.slice(1), name);
const root = await mkdtemp(path.join(os.tmpdir(), 'nx-full-recovery-'));
assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
const bin = process.env.MARIADB_BIN ?? path.join(os.homedir(), 'nextract-cms', 'mariadb-11.4.5-winx64', 'bin');
const exe = process.platform === 'win32' ? '.exe' : '';
const tool = (command: string) => existsSync(path.join(bin, command + exe)) ? path.join(bin, command + exe) : command;
const auth = [`--host=${original.hostname}`, `--port=${original.port || '3306'}`, `--user=${decodeURIComponent(original.username)}`, '--default-character-set=utf8mb4'];
const childEnv = { ...process.env, MYSQL_PWD: decodeURIComponent(original.password) };
function sql(input: string, database?: string) {
  const result = spawnSync(tool('mariadb'), [...auth, ...(database ? [database] : [])], { input, encoding: 'utf8', env: childEnv, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Isolated recovery database command failed; no credentials or SQL parameters are logged.');
}
let created = false;
let client: { $disconnect(): Promise<void> } | undefined;
try {
  // The identifier is generated and validated above, never supplied by a user.
  // CREATE without IF NOT EXISTS ensures cleanup cannot target an old database.
  sql(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  created = true;
  const schema = spawnSync(tool('mariadb-dump'), [...auth, '--no-data', '--skip-triggers', '--skip-add-locks', '--no-tablespaces', original.pathname.slice(1)], { encoding: 'utf8', env: childEnv, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (schema.status !== 0) throw new Error('Could not read the local schema for the isolated restore drill.');
  assert.ok(!/^\s*(?:CREATE\s+DATABASE|USE)\b/im.test(schema.stdout), 'Schema copy must not select another database.');
  assert.ok(!schema.stdout.includes(`\`${original.pathname.slice(1)}\`.`), 'Schema must not contain cross-database references.');
  sql(schema.stdout, name);
  const target = new URL(original); target.pathname = `/${name}`;
  process.env.DATABASE_URL = target.toString();
  process.env.BACKUP_DIR = path.join(root, 'archives');
  process.env.UPLOAD_DIR = path.join(root, 'uploads');
  process.env.SITE_ROOT = path.join(root, 'site');
  process.env.SITE_PUBLIC_DIR = path.join(root, 'site', 'public');
  process.env.STORAGE_DRIVER = 'local';
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const { db } = await import('../src/db.ts'); client = db;
  const { startBackup, runBackupJob, restoreBackup, archivePathFor, importBackup } = await import('../src/lib/backup.ts');
  const actor = await db.user.create({ data: { email: 'restore-fixture@example.invalid', name: 'Original fixture administrator', passwordHash: 'unusable-disposable-fixture', role: 'SUPER_ADMIN' } });
  await db.setting.create({ data: { key: 'recovery-fixture', value: { marker: 'original', nested: ['one', 'two'] } } });
  const post = await db.post.create({ data: { title: 'Original fixture post', slug: 'restore-fixture', authorId: actor.id, contentHtml: '<p>Original fixture body</p>', contentJson: {}, relatedIds: [], seo: {} } });
  await mkdir(process.env.UPLOAD_DIR, { recursive: true }); await mkdir(process.env.SITE_PUBLIC_DIR, { recursive: true });
  const asset = path.join(process.env.UPLOAD_DIR, 'fixture.txt');
  await writeFile(asset, 'original media');
  const row = await startBackup({ name: 'Disposable full recovery drill', includeDb: true, includeFiles: true, includeCode: false, createdById: actor.id, runInBackground: false });
  await runBackupJob(row.id);
  assert.ok((await db.backup.findUniqueOrThrow({ where: { id: row.id } })).storageKey.endsWith('.tar.gz'));
  const archive = await archivePathFor(row.id); assert.ok(archive);
  const uploaded = await importBackup(archive.path, 'full-recovery.tar.gz', actor.id);
  await db.user.update({ where: { id: actor.id }, data: { name: 'Changed administrator' } });
  await db.post.delete({ where: { id: post.id } });
  await db.setting.update({ where: { key: 'recovery-fixture' }, data: { value: { marker: 'changed' } } });
  await writeFile(asset, 'changed media');
  const restored = await restoreBackup(uploaded.id, actor.id);
  assert.equal(restored.ok, true);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: actor.id } })).name, 'Original fixture administrator');
  assert.equal((await db.post.findUniqueOrThrow({ where: { id: post.id } })).contentHtml, '<p>Original fixture body</p>');
  assert.deepEqual((await db.setting.findUniqueOrThrow({ where: { key: 'recovery-fixture' } })).value, { marker: 'original', nested: ['one', 'two'] });
  assert.equal(await readFile(asset, 'utf8'), 'original media');
  assert.equal((await db.backup.findUniqueOrThrow({ where: { id: restored.safetyBackupId } })).status, 'SUCCESS');
  console.log('PASS: uploaded plain full SQL + file restore, deleted-row recovery, user/content/settings consistency, and pre-restore safety archive. Only a newly created disposable database was restored.');
} finally {
  await client?.$disconnect();
  if (created) {
    assert.match(name, /^nextract_recovery_[a-f0-9]{16}$/);
    assert.notEqual(name, original.pathname.slice(1));
    sql(`DROP DATABASE \`${name}\`;`);
  }
  // Exact temporary directory created and checked by this script.
  await rm(root, { recursive: true, force: true });
}
