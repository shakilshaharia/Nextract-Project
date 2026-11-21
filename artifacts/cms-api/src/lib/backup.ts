// Website Backup & Restore.
//
// A backup is a single gzip tar archive holding, as the admin chooses:
//   - database.sql         a full dump of the MySQL/MariaDB database
//   - files/uploads/       the CMS media library (UPLOAD_DIR)
//   - files/site-public/   the website's static assets (images, videos, …)
//   - files/site-code/     the website source code (minus node_modules/.next)
//   - manifest.json        what the archive contains and when it was made
//
// "Database + files" together are a complete snapshot of everything the site
// shows; adding the source code makes the archive a self-contained copy of the
// whole website. Archives live in BACKUP_DIR, which is never served to the
// public (only /uploads and /admin are). The database password is passed to
// the dump and restore tools through the MYSQL_PWD environment variable, never
// on the command line. Every archive is checksummed (SHA-256) on creation and
// verified before any restore.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { chmod, cp, mkdir, mkdtemp, open, readFile, readdir, rm, stat, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { invalidateContent } from './content.ts';
import { uploadRoot } from './storage.ts';
import { decryptBackup, isCredentialFile } from './backup-crypto.ts';
import { BACKUP_UPLOAD_CHUNK_BYTES, MAX_BACKUP_UPLOAD_BYTES, extractBackupArchive } from './backup-archive.ts';
import { HttpError, badRequest, notFound } from './http.ts';

// ---------------------------------------------------------------------------
// Where things live
// ---------------------------------------------------------------------------

// Archives are kept outside the repo and outside any served directory.
export const backupDir = path.resolve(process.env.BACKUP_DIR ?? path.join(uploadRoot, '..', 'backups'));

// The public website. By default the Next.js app sits at ../nextract relative
// to this API; both can be pointed elsewhere for production.
const siteRoot = path.resolve(process.env.SITE_ROOT ?? path.join(uploadRoot, '..', '..', 'nextract'));
const sitePublicDir = path.resolve(process.env.SITE_PUBLIC_DIR ?? path.join(siteRoot, 'public'));

// Directories inside the source tree that are regenerated, so they are never
// backed up and never wiped on restore.
const CODE_EXCLUDES = new Set(['node_modules', '.next', 'dist', '.turbo', '.git']);

// Each named component knows where it lives and how a restore puts it back:
//   replace — the backed-up copy is authoritative; the target is wiped first.
//   overlay — copied over the target so untracked things (node_modules) survive.
type Component = { dir: string; mode: 'replace' | 'overlay'; excludeTop?: boolean };
const COMPONENTS: Record<string, Component> = {
  uploads: { dir: uploadRoot, mode: 'replace' },
  'site-public': { dir: sitePublicDir, mode: 'replace' },
  'site-code': { dir: siteRoot, mode: 'overlay', excludeTop: true },
};

// Which components a backup should capture, given the chosen options.
function selectedComponents(includeFiles: boolean, includeCode: boolean): string[] {
  const names: string[] = [];
  if (includeFiles) {
    names.push('uploads');
    if (existsSync(sitePublicDir)) names.push('site-public');
  }
  if (includeCode && existsSync(siteRoot)) names.push('site-code');
  return names;
}

// A fs.cp filter that skips regenerated top-level folders for the source tree.
function copyFilterFor(name: string): ((src: string) => boolean) | undefined {
  const comp = COMPONENTS[name];
  if (!comp?.excludeTop) return undefined;
  return (src: string) => {
    const rel = path.relative(comp.dir, src);
    if (!rel) return true;
    return !rel.split(path.sep).some((part) => CODE_EXCLUDES.has(part) || isCredentialFile(part));
  };
}

async function ensureBackupDir() {
  const inside = (parent: string) => { const rel = path.relative(parent, backupDir); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
  const publicDirs = [uploadRoot, sitePublicDir, ...[env.ADMIN_DIST, env.SITE_DIST].filter((dir): dir is string => Boolean(dir)).map((dir) => path.resolve(dir))];
  if (publicDirs.some(inside)) throw new Error('BACKUP_DIR must be outside public file directories.');
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
}

async function copyDir(src: string, dest: string, filter?: (src: string) => boolean) {
  await cp(src, dest, { recursive: true, filter });
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else total += await stat(full).then((s) => s.size).catch(() => 0);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Database connection details (parsed once from DATABASE_URL)
// ---------------------------------------------------------------------------

type DbConn = { host: string; port: string; user: string; password: string; database: string };

function parseDbUrl(url: string): DbConn {
  const u = new URL(url);
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port || '3306',
    user: decodeURIComponent(u.username || 'root'),
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, '') || '',
  };
}

const conn = parseDbUrl(env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Finding the dump / restore tools
// ---------------------------------------------------------------------------

const EXE = process.platform === 'win32' ? '.exe' : '';

function resolveBin(names: string[]): string {
  const dirs = [
    process.env.MARIADB_BIN,
    // The portable MariaDB that ships with local dev.
    'C:/Users/shaki/nextract-cms/mariadb-11.4.5-winx64/bin',
    '/usr/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ].filter(Boolean) as string[];
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, `${name}${EXE}`);
      if (existsSync(full)) return full;
    }
  }
  // Fall back to the first name and hope it is on PATH.
  return names[0];
}

const dumpBin = resolveBin(['mariadb-dump', 'mysqldump']);
const clientBin = resolveBin(['mariadb', 'mysql']);
// Prefer the native Windows tar (bsdtar in System32), which understands
// Windows paths; otherwise rely on tar from PATH. We stream the archive
// through stdin/stdout and set the child's cwd instead of passing a directory
// argument, so a drive-letter path is never handed to tar's parser.
function resolveTar(): string {
  if (process.env.TAR_BIN) return process.env.TAR_BIN;
  if (process.platform === 'win32') {
    const sys = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe');
    if (existsSync(sys)) return sys;
  }
  return 'tar';
}
const tarBin = resolveTar();

// ---------------------------------------------------------------------------
// Small process helpers
// ---------------------------------------------------------------------------

type RunResult = { code: number; stderr: string };

// Run a command, sending its stdout to a file. Used for the database dump.
function runToFile(bin: string, args: string[], outFile: string, extraEnv: NodeJS.ProcessEnv = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: { ...process.env, ...extraEnv } });
    const out = createWriteStream(outFile, { mode: 0o600 });
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', (chunk) => { if (stderr.length < 8000) stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      out.end(() => resolve({ code: code ?? 1, stderr }));
    });
  });
}

// Run a command, feeding a file to its stdin. Used for the database restore.
function runFromFile(bin: string, args: string[], inFile: string, extraEnv: NodeJS.ProcessEnv = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: { ...process.env, ...extraEnv } });
    const input = createReadStream(inFile);
    let stderr = '';
    child.stderr.on('data', (chunk) => { if (stderr.length < 8000) stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
    input.on('error', reject);
    input.pipe(child.stdin);
  });
}

// Create a gzip tar of everything in `srcDir`, written to `outFile`. The child
// runs with cwd = srcDir and archives '.', so no directory path is parsed by tar.
function tarCreate(srcDir: string, outFile: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(tarBin, ['-czf', '-', '.'], { cwd: srcDir });
    const out = createWriteStream(outFile, { mode: 0o600 });
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', (chunk) => { if (stderr.length < 8000) stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => out.end(() => resolve({ code: code ?? 1, stderr })));
  });
}

// Extract a gzip tar (read from `archive`) into `destDir` (the child's cwd).
async function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// ---------------------------------------------------------------------------
// Backup settings (schedule + retention), stored in the Setting table
// ---------------------------------------------------------------------------

export const backupSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  // 24h local-to-timezone time, HH:MM.
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('03:00'),
  // 0 = Sunday … 6 = Saturday (weekly).
  weekday: z.number().int().min(0).max(6).default(0),
  // Day of month 1..28 (monthly) — capped at 28 so it exists in every month.
  monthday: z.number().int().min(1).max(28).default(1),
  timezone: z.string().default('UTC'),
  includeDb: z.boolean().default(true),
  includeFiles: z.boolean().default(true),
  includeCode: z.boolean().default(false),
  retentionDaily: z.number().int().min(1).max(365).default(7),
  retentionWeekly: z.number().int().min(1).max(260).default(4),
  retentionMonthly: z.number().int().min(1).max(120).default(12),
  retentionManual: z.number().int().min(1).max(500).default(30),
});

export type BackupSettings = z.infer<typeof backupSettingsSchema>;

export async function getBackupSettings(): Promise<BackupSettings> {
  const row = await db.setting.findUnique({ where: { key: 'backup' } });
  const parsed = backupSettingsSchema.safeParse({ ...(row?.value as object | null) });
  return parsed.success ? parsed.data : backupSettingsSchema.parse({});
}

export async function saveBackupSettings(input: unknown): Promise<BackupSettings> {
  const value = backupSettingsSchema.parse(input);
  await db.setting.upsert({ where: { key: 'backup' }, update: { value }, create: { key: 'backup', value } });
  return value;
}

// ---------------------------------------------------------------------------
// Creating a backup
// ---------------------------------------------------------------------------

export type BackupType = 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PRE_RESTORE';

function defaultName(type: BackupType, now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const label = { MANUAL: 'Manual', DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', PRE_RESTORE: 'Pre-restore safety' }[type];
  return `${label} backup — ${stamp} UTC`;
}

type CreateOptions = {
  type?: BackupType;
  name?: string;
  includeDb?: boolean;
  includeFiles?: boolean;
  includeCode?: boolean;
  createdById?: string | null;
  note?: string;
  runInBackground?: boolean;
};

// Creates the Backup row immediately (status RUNNING) and performs the work in
// the background, so the API can return at once. Callers that need the archive
// right away (the pre-restore safety copy) can await `runBackupJob` instead.
export async function startBackup(options: CreateOptions = {}) {
  const now = new Date();
  const type = options.type ?? 'MANUAL';
  const includeDb = options.includeDb ?? true;
  const includeFiles = options.includeFiles ?? true;
  const includeCode = options.includeCode ?? false;
  const row = await db.backup.create({
    data: {
      name: options.name?.trim() || defaultName(type, now),
      type,
      status: 'RUNNING',
      includesDb: includeDb,
      includesFiles: includeFiles,
      includesCode: includeCode,
      note: options.note ?? '',
      createdById: options.createdById ?? null,
      startedAt: now,
    },
  });
  // Fire and forget; status is polled by the dashboard.
  if (options.runInBackground !== false) void runBackupJob(row.id).catch(() => console.error('[backup] job failed; inspect its private admin status'));
  return row;
}

// The actual work for one backup row. Resolves to the finished row.
export async function runBackupJob(backupId: string) {
  const row = await db.backup.findUnique({ where: { id: backupId } });
  if (!row) throw new Error('Backup row disappeared');
  await ensureBackupDir();
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-backup-'));
  const archiveName = `${row.id}.tar.gz`;
  const archivePath = path.join(backupDir, archiveName);

  try {
    // 1) Database dump.
    if (row.includesDb) {
      if (!conn.database) throw new Error('No database name in DATABASE_URL');
      const sqlFile = path.join(work, 'database.sql');
      const args = [
        `--host=${conn.host}`, `--port=${conn.port}`, `--user=${conn.user}`,
        '--single-transaction', '--quick', '--routines', '--events',
        '--add-drop-table', '--no-tablespaces', '--default-character-set=utf8mb4',
        // Never dump the backup history itself: restoring a dump that captured
        // an in-progress backup would otherwise resurrect a stale "running" row
        // and wipe newer backup records.
        `--ignore-table=${conn.database}.Backup`,
        '--databases', conn.database,
      ];
      const result = await runToFile(dumpBin, args, sqlFile, { MYSQL_PWD: conn.password });
      if (result.code !== 0) throw new Error(`Database dump failed: ${result.stderr.trim() || `exit ${result.code}`}`);
    }

    // 2) Website files: CMS uploads, the site's static assets, and optionally
    //    the source code — each copied under files/<component>/.
    const components = selectedComponents(row.includesFiles, row.includesCode);
    for (const name of components) {
      const comp = COMPONENTS[name];
      const dest = path.join(work, 'files', name);
      if (existsSync(comp.dir)) await copyDir(comp.dir, dest, copyFilterFor(name));
      else await mkdir(dest, { recursive: true });
    }

    // 3) Manifest.
    const manifest = {
      version: 2,
      id: row.id,
      createdAt: new Date().toISOString(),
      type: row.type,
      database: row.includesDb ? conn.database : null,
      includesDb: row.includesDb,
      includesFiles: row.includesFiles,
      includesCode: row.includesCode,
      components,
    };
    await writeFile(path.join(work, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // 4) Archive, checksum, size.
    const tarResult = await tarCreate(work, archivePath);
    if (tarResult.code !== 0) throw new Error(`Archiving failed: ${tarResult.stderr.trim() || `exit ${tarResult.code}`}`);
    const [checksum, info] = await Promise.all([sha256File(archivePath), stat(archivePath)]);

    const done = await db.backup.update({
      where: { id: row.id },
      data: {
        status: 'SUCCESS',
        storageKey: archiveName,
        checksum,
        sizeBytes: BigInt(info.size),
        finishedAt: new Date(),
        error: '',
      },
    });
    return done;
  } catch (error) {
    await rm(archivePath, { force: true }).catch(() => undefined);
    await db.backup.update({
      where: { id: row.id },
      data: { status: 'FAILED', error: (error as Error).message.slice(0, 2000), finishedAt: new Date() },
    });
    throw error;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Restoring a backup
// ---------------------------------------------------------------------------

let restoreInProgress = false;
export async function restoreBackup(backupId: string, actorId?: string | null) {
  if (restoreInProgress) throw badRequest('Another restore is already running.');
  restoreInProgress = true;
  try { return await restoreBackupJob(backupId, actorId); }
  finally { restoreInProgress = false; }
}

async function restoreBackupJob(backupId: string, actorId?: string | null) {
  const row = await db.backup.findUnique({ where: { id: backupId } });
  if (!row) throw new Error('Backup not found');
  if (row.status !== 'SUCCESS') throw new Error('Only a completed backup can be restored');
  const archivePath = resolveArchive(row.storageKey);
  if (!existsSync(archivePath)) throw new Error('Backup archive is missing from disk');

  // Integrity check.
  const checksum = await sha256File(archivePath);
  if (row.checksum && checksum !== row.checksum) throw new Error('Backup failed its integrity check (checksum mismatch) and was not restored');

  // A safety backup of the current state, before we overwrite anything.
  if (row.storageKey.endsWith('.enc') && !env.BACKUP_ENCRYPTION_KEY) throw new Error('The backup encryption key is required before restoring this archive.');
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-restore-'));
  try {
    let input = archivePath;
    if (row.storageKey.endsWith('.enc')) {
      input = path.join(work, 'decrypted.tar.gz');
      await decryptBackup(archivePath, input, env.BACKUP_ENCRYPTION_KEY!);
    }
    const extracted = path.join(work, 'contents');
    const manifest = await extractBackupArchive(input, extracted);
    if (manifest.includesDb && manifest.database !== conn.database) throw badRequest('This backup belongs to a different database. Use a backup from this website.');
    if (row.includesDb !== manifest.includesDb || row.includesFiles !== manifest.includesFiles || row.includesCode !== manifest.includesCode) throw badRequest('Backup contents do not match its history record.');
    const safety = await startBackup({ type: 'PRE_RESTORE', name: `Before restoring "${row.name}"`, includeCode: row.includesCode, createdById: actorId ?? null, runInBackground: false });
    await runBackupJob(safety.id).catch(() => { throw new Error('Could not take a safety backup first, so nothing was changed.'); });
    await db.backup.update({ where: { id: row.id }, data: { restoringAt: new Date() } });

    // 1) Database.
    const sqlFile = path.join(extracted, 'database.sql');
    if (row.includesDb && existsSync(sqlFile)) {
      const args = [`--host=${conn.host}`, `--port=${conn.port}`, `--user=${conn.user}`, '--binary-mode=1', '--local-infile=0', conn.database];
      const result = await runFromFile(clientBin, args, sqlFile, { MYSQL_PWD: conn.password });
      if (result.code !== 0) throw new Error(`Database restore failed: ${result.stderr.trim() || `exit ${result.code}`}`);
    }

    // 2) Website files, per the archive's manifest. "replace" components (CMS
    //    uploads, the site's static assets) are wiped and rewritten; "overlay"
    //    components (source code) are copied over so node_modules survive.
    for (const name of manifest.components) {
      const comp = COMPONENTS[name];
      if (!comp) continue;
      const src = path.join(extracted, 'files', name);
      if (!existsSync(src)) continue;
      await mkdir(path.dirname(comp.dir), { recursive: true });
      if (comp.mode === 'replace') await rm(comp.dir, { recursive: true, force: true }).catch(() => undefined);
      await copyDir(src, comp.dir, comp.excludeTop ? (file) => !path.relative(src, file).split(path.sep).some((part) => CODE_EXCLUDES.has(part) || isCredentialFile(part)) : undefined);
    }

    invalidateContent();
    await db.activityLog.create({
      data: { userId: actorId ?? null, action: 'restore', entityType: 'backup', entityId: row.id, summary: `Restored website from backup "${row.name}"`.slice(0, 300) },
    });
    return { ok: true, safetyBackupId: safety.id };
  } finally {
    await db.backup.update({ where: { id: row.id }, data: { restoringAt: null } }).catch(() => undefined);
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Listing, stats, delete
// ---------------------------------------------------------------------------

export function backupToJson(row: {
  id: string; name: string; type: string; status: string; includesDb: boolean; includesFiles: boolean; includesCode: boolean;
  sizeBytes: bigint; storageDriver: string; checksum: string; note: string; error: string;
  startedAt: Date | null; finishedAt: Date | null; restoringAt: Date | null; createdById: string | null; createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    includesDb: row.includesDb,
    includesFiles: row.includesFiles,
    includesCode: row.includesCode,
    sizeBytes: Number(row.sizeBytes),
    storageDriver: row.storageDriver,
    checksum: row.checksum,
    note: row.note,
    error: row.error,
    restoring: row.restoringAt !== null,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function archivePathFor(backupId: string): Promise<{ name: string; path: string } | null> {
  const row = await db.backup.findUnique({ where: { id: backupId } });
  if (!row || row.status !== 'SUCCESS' || !row.storageKey) return null;
  const full = resolveArchive(row.storageKey);
  if (!existsSync(full)) return null;
  return { name: `${row.name.replace(/[^\w.-]+/g, '_')}.tar.gz${row.storageKey.endsWith('.enc') ? '.enc' : ''}`, path: full };
}

/** All downloads are ordinary archives, including historical encrypted backups. */
export async function prepareBackupDownload(backupId: string) {
  const file = await archivePathFor(backupId);
  if (!file) return null;
  if (!file.name.endsWith('.enc')) return { ...file, cleanup: async () => {} };
  if (!env.BACKUP_ENCRYPTION_KEY) throw badRequest('The original backup key is needed to download this older backup.');
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-backup-download-'));
  const cleanup = () => rm(work, { recursive: true, force: true });
  try {
    const plain = path.join(work, 'backup.tar.gz');
    await decryptBackup(file.path, plain, env.BACKUP_ENCRYPTION_KEY);
    return { path: plain, name: file.name.slice(0, -4), cleanup };
  } catch (error) { await cleanup(); throw error; }
}

/** Import into history only. Restoring remains a separate explicit operation. */
async function finalizeImportedBackup(file: string, originalName: string, actorId: string, existingId?: string) {
  await ensureBackupDir();
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-backup-import-'));
  let stored: string | undefined;
  try {
    let archive = file;
    if (originalName.toLowerCase().endsWith('.enc')) {
      if (!env.BACKUP_ENCRYPTION_KEY) throw badRequest('The original backup key is needed to upload this older backup.');
      archive = path.join(work, 'decrypted.tar.gz');
      await decryptBackup(file, archive, env.BACKUP_ENCRYPTION_KEY);
    }
    const manifest = await extractBackupArchive(archive, path.join(work, 'contents'));
    if (manifest.includesDb && manifest.database !== conn.database) throw badRequest('This backup belongs to a different database. Upload a backup from this website.');
    const checksum = await sha256File(archive);
    const size = (await stat(archive)).size;
    const storageKey = existingId
      ? `uploaded-${existingId}.tar.gz`
      : `uploaded-${createHash('sha256').update(checksum + ':' + Date.now() + ':' + work).digest('hex')}.tar.gz`;
    stored = resolveArchive(storageKey);
    await cp(archive, stored, { errorOnExist: true, force: false });
    await chmod(stored, 0o600);
    const data = {
      name: `Uploaded: ${path.basename(originalName).replace(/\.tar\.gz(?:\.enc)?$/i, '').slice(0, 200)}`,
      status: 'SUCCESS' as const, includesDb: manifest.includesDb, includesFiles: manifest.includesFiles,
      includesCode: manifest.includesCode, storageKey, checksum, sizeBytes: BigInt(size),
      note: 'Uploaded backup. Restore separately after reviewing its contents.', error: '', finishedAt: new Date(),
    };
    const row = existingId
      ? await db.backup.update({ where: { id: existingId }, data })
      : await db.backup.create({ data: {
          ...data,
          type: 'MANUAL', createdById: actorId, startedAt: new Date(),
        } });
    stored = undefined;
    return row;
  } catch (error) {
    if (stored) await rm(stored, { force: true });
    throw badRequest(error instanceof Error && error.name !== 'ZodError' ? error.message : 'Invalid Nextract backup archive.');
  } finally { await rm(work, { recursive: true, force: true }); }
}

export async function importBackup(file: string, originalName: string, actorId: string) {
  return finalizeImportedBackup(file, originalName, actorId);
}

// Large browser uploads arrive as small ordered chunks so CDN and reverse-proxy
// request limits never need to be raised to the full 5 GB archive size.
const uploadWorkDir = path.join(backupDir, '.uploads');
const uploadMetaSchema = z.object({
  originalName: z.string().min(1).max(255),
  expectedSize: z.number().int().positive().max(MAX_BACKUP_UPLOAD_BYTES),
  actorId: z.string().min(1),
  finalizing: z.boolean().default(false),
});
type UploadMeta = z.infer<typeof uploadMetaSchema>;
const activeUploadIds = new Set<string>();

function uploadFiles(id: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw badRequest('Invalid backup upload.');
  return { part: path.join(uploadWorkDir, `${id}.part`), meta: path.join(uploadWorkDir, `${id}.json`), chunk: path.join(uploadWorkDir, `${id}.chunk`) };
}

async function withUploadLock<T>(id: string, task: () => Promise<T>) {
  if (activeUploadIds.has(id)) throw new HttpError(409, 'That backup upload is already being updated.', 'upload_busy');
  activeUploadIds.add(id);
  try { return await task(); }
  finally { activeUploadIds.delete(id); }
}

async function uploadState(id: string, actorId: string) {
  const row = await db.backup.findUnique({ where: { id } });
  if (!row || row.createdById !== actorId || row.status !== 'RUNNING') throw notFound('Backup upload');
  const files = uploadFiles(id);
  let meta: UploadMeta;
  try { meta = uploadMetaSchema.parse(JSON.parse(await readFile(files.meta, 'utf8'))); }
  catch { throw notFound('Backup upload'); }
  if (meta.actorId !== actorId) throw notFound('Backup upload');
  const received = await stat(files.part).then(value => value.size).catch(() => -1);
  if (received < 0 || received > meta.expectedSize) throw badRequest('The backup upload is incomplete or damaged.');
  return { row, files, meta, received };
}

export async function startBackupUpload(originalName: string, expectedSize: number, actorId: string) {
  if (!/\.tar\.gz(?:\.enc)?$/i.test(originalName)) throw badRequest('Choose a Nextract .tar.gz backup (or an older .tar.gz.enc backup).');
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > MAX_BACKUP_UPLOAD_BYTES) {
    throw new HttpError(413, 'The backup must be no larger than 5 GB.', 'upload_size');
  }
  await ensureBackupDir();
  await mkdir(uploadWorkDir, { recursive: true, mode: 0o700 });
  const cleanName = path.basename(originalName).slice(0, 255);
  const row = await db.backup.create({ data: {
    name: `Uploading: ${cleanName.replace(/\.tar\.gz(?:\.enc)?$/i, '').slice(0, 200)}`,
    type: 'MANUAL', status: 'RUNNING', includesDb: false, includesFiles: false, includesCode: false,
    note: 'Receiving an uploaded backup in verified chunks.', createdById: actorId, startedAt: new Date(),
  } });
  const files = uploadFiles(row.id);
  try {
    const handle = await open(files.part, 'wx', 0o600); await handle.close();
    await writeFile(files.meta, JSON.stringify({ originalName: cleanName, expectedSize, actorId, finalizing: false }), { flag: 'wx', mode: 0o600 });
    return row;
  } catch (error) {
    await Promise.all([rm(files.part, { force: true }), rm(files.meta, { force: true })]);
    await db.backup.update({ where: { id: row.id }, data: { status: 'FAILED', error: 'Could not initialize the upload.', finishedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

export async function backupUploadStatus(id: string, actorId: string) {
  const { meta, received } = await uploadState(id, actorId);
  return { received, expectedSize: meta.expectedSize, finalizing: meta.finalizing, chunkBytes: BACKUP_UPLOAD_CHUNK_BYTES };
}

export async function appendBackupUpload(id: string, actorId: string, offset: number, body: Readable, contentLength?: number) {
  return withUploadLock(id, async () => {
    const { files, meta, received } = await uploadState(id, actorId);
    if (meta.finalizing) throw new HttpError(409, 'This backup is already being checked.', 'upload_finalizing');
    if (!Number.isSafeInteger(offset) || offset !== received) throw new HttpError(409, `Resume this upload at byte ${received}.`, 'upload_offset', { offset: String(received) });
    if (contentLength !== undefined && (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > BACKUP_UPLOAD_CHUNK_BYTES || received + contentLength > meta.expectedSize)) {
      throw new HttpError(413, 'This backup chunk is too large.', 'upload_size');
    }
    let bytes = 0;
    const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > BACKUP_UPLOAD_CHUNK_BYTES || received + bytes > meta.expectedSize) return callback(new HttpError(413, 'This backup chunk is too large.', 'upload_size'));
      callback(null, chunk);
    } });
    try {
      await pipeline(body, counter, createWriteStream(files.chunk, { flags: 'wx', mode: 0o600 }));
      if (!bytes || (contentLength !== undefined && bytes !== contentLength)) throw badRequest('The backup chunk was incomplete.');
      try { await pipeline(createReadStream(files.chunk), createWriteStream(files.part, { flags: 'a', mode: 0o600 })); }
      catch (error) { await truncate(files.part, received).catch(() => undefined); throw error; }
      return { received: received + bytes, expectedSize: meta.expectedSize };
    } finally { await rm(files.chunk, { force: true }).catch(() => undefined); }
  });
}

export async function finishBackupUpload(id: string, actorId: string) {
  const result = await withUploadLock(id, async () => {
    const state = await uploadState(id, actorId);
    if (state.meta.finalizing) throw new HttpError(409, 'This backup is already being checked.', 'upload_finalizing');
    if (state.received !== state.meta.expectedSize) throw badRequest(`The upload is incomplete. Resume at byte ${state.received}.`);
    const meta = { ...state.meta, finalizing: true };
    await writeFile(state.files.meta, JSON.stringify(meta), { mode: 0o600 });
    return { ...state, meta };
  });
  void withUploadLock(id, async () => {
    try { await finalizeImportedBackup(result.files.part, result.meta.originalName, actorId, id); }
    catch (error) {
      await db.backup.update({ where: { id }, data: { status: 'FAILED', error: (error as Error).message.slice(0, 2000), finishedAt: new Date() } }).catch(() => undefined);
    } finally {
      await Promise.all([rm(result.files.part, { force: true }), rm(result.files.meta, { force: true }), rm(result.files.chunk, { force: true })]);
    }
  }).catch(() => undefined);
  return result.row;
}

export async function cancelBackupUpload(id: string, actorId: string) {
  return withUploadLock(id, async () => {
    const { files, meta } = await uploadState(id, actorId);
    if (meta.finalizing) throw new HttpError(409, 'This backup is already being checked.', 'upload_finalizing');
    await Promise.all([rm(files.part, { force: true }), rm(files.meta, { force: true }), rm(files.chunk, { force: true })]);
    return db.backup.update({ where: { id }, data: { status: 'FAILED', error: 'Upload cancelled before completion.', finishedAt: new Date() } });
  });
}

function resolveArchive(key: string) {
  const full = path.resolve(backupDir, key);
  if (!key || !full.startsWith(backupDir + path.sep)) throw new Error('Invalid archive storage key.');
  return full;
}

export async function deleteBackup(backupId: string) {
  const row = await db.backup.findUnique({ where: { id: backupId } });
  if (!row) throw new Error('Backup not found');
  if (row.status === 'RUNNING' || row.status === 'PENDING') throw new Error('This backup is still being created');
  if (row.restoringAt) throw new Error('This backup is being restored right now');
  if (row.storageKey) await rm(resolveArchive(row.storageKey), { force: true }).catch(() => undefined);
  await db.backup.delete({ where: { id: row.id } });
}

// Any backup left RUNNING/PENDING with no live job behind it — the process was
// restarted mid-backup, say — is marked FAILED so the dashboard never shows a
// job that is not actually happening. Called once at startup; safe because no
// job can have survived the restart.
export async function reconcileStuckBackups() {
  await ensureBackupDir();
  const stuck = await db.backup.updateMany({
    where: { status: { in: ['RUNNING', 'PENDING'] } },
    data: { status: 'FAILED', error: 'Interrupted — the server restarted before this backup finished. Create a new one.', finishedAt: new Date() },
  });
  await rm(uploadWorkDir, { recursive: true, force: true }).catch(() => undefined);
  await db.backup.updateMany({ where: { restoringAt: { not: null } }, data: { restoringAt: null } });
  if (stuck.count) console.log(`[backup] marked ${stuck.count} interrupted backup(s) as failed`);
  return stuck.count;
}

export async function backupStats() {
  const [total, success, failed, sizeAgg, last, settings] = await Promise.all([
    db.backup.count(),
    db.backup.count({ where: { status: 'SUCCESS' } }),
    db.backup.count({ where: { status: 'FAILED' } }),
    db.backup.aggregate({ _sum: { sizeBytes: true }, where: { status: 'SUCCESS' } }),
    db.backup.findFirst({ where: { status: 'SUCCESS' }, orderBy: { finishedAt: 'desc' } }),
    getBackupSettings(),
  ]);
  return {
    total,
    success,
    failed,
    running: await db.backup.count({ where: { status: { in: ['RUNNING', 'PENDING'] } } }),
    totalSize: Number(sizeAgg._sum.sizeBytes ?? 0n),
    lastBackupAt: last?.finishedAt?.toISOString() ?? null,
    nextBackupAt: settings.enabled ? nextScheduledAt(settings).toISOString() : null,
    scheduleEnabled: settings.enabled,
  };
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

// Parts of `date` in a given IANA timezone.
function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === '24' ? '00' : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday as string] ?? 0,
    month: `${parts.year}-${parts.month}`,
  };
}

// The period key identifies the slot a scheduled run belongs to, so we never
// run twice for the same day/week/month.
function periodKey(settings: BackupSettings, date: Date): string {
  const p = zonedParts(date, settings.timezone);
  if (settings.frequency === 'daily') return `D:${p.ymd}`;
  if (settings.frequency === 'monthly') return `M:${p.month}`;
  // Weekly: key by the date of the most recent configured weekday.
  return `W:${p.ymd}:${settings.weekday}`;
}

// Is a scheduled backup due right now?
function isDue(settings: BackupSettings, now: Date): boolean {
  const p = zonedParts(now, settings.timezone);
  const [h, m] = settings.time.split(':').map(Number);
  const pastTime = p.hour > h || (p.hour === h && p.minute >= m);
  if (!pastTime) return false;
  if (settings.frequency === 'weekly' && p.weekday !== settings.weekday) return false;
  if (settings.frequency === 'monthly') {
    const day = Number(p.ymd.slice(-2));
    if (day !== settings.monthday) return false;
  }
  return true;
}

// The next time a scheduled backup will run (approximate, for display).
export function nextScheduledAt(settings: BackupSettings, from = new Date()): Date {
  const [h, m] = settings.time.split(':').map(Number);
  for (let i = 0; i <= 366; i += 1) {
    const candidate = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const p = zonedParts(candidate, settings.timezone);
    const okDay =
      settings.frequency === 'daily' ||
      (settings.frequency === 'weekly' && p.weekday === settings.weekday) ||
      (settings.frequency === 'monthly' && Number(p.ymd.slice(-2)) === settings.monthday);
    if (!okDay) continue;
    const afterNow = i > 0 || p.hour < h || (p.hour === h && p.minute < m);
    if (afterNow) {
      // Build an approximate timestamp for that day's HH:MM in local server time.
      const [y, mo, d] = p.ymd.split('-').map(Number);
      return new Date(Date.UTC(y, mo - 1, d, h, m));
    }
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

const scheduledTypeFor: Record<BackupSettings['frequency'], BackupType> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
};

// Called from the scheduler once a minute: run a scheduled backup if one is due
// and has not already run for this period, then apply the retention policy.
export async function runScheduledBackups(now = new Date()) {
  const settings = await getBackupSettings();
  if (settings.enabled && isDue(settings, now)) {
    const type = scheduledTypeFor[settings.frequency];
    const since = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const recent = await db.backup.findMany({
      where: { type, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const key = periodKey(settings, now);
    const already = recent.some((b) => periodKey(settings, b.createdAt) === key);
    if (!already) {
      await startBackup({ type, includeDb: settings.includeDb, includeFiles: settings.includeFiles, includeCode: settings.includeCode, note: 'Scheduled automatically' });
      console.log(`[backup] started scheduled ${type} backup`);
    }
  }
  await applyRetention(settings).catch((error) => console.warn('[backup] retention:', (error as Error).message));
}

async function applyRetention(settings: BackupSettings) {
  const plan: [BackupType, number][] = [
    ['DAILY', settings.retentionDaily],
    ['WEEKLY', settings.retentionWeekly],
    ['MONTHLY', settings.retentionMonthly],
    ['MANUAL', settings.retentionManual],
    ['PRE_RESTORE', 10],
  ];
  for (const [type, keep] of plan) {
    const rows = await db.backup.findMany({
      where: { type, status: 'SUCCESS', restoringAt: null },
      orderBy: { createdAt: 'desc' },
    });
    for (const row of rows.slice(keep)) {
      await deleteBackup(row.id).catch(() => undefined);
    }
  }
}
