import { createReadStream } from 'node:fs';
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { z } from 'zod';
import { isCredentialFile } from './backup-crypto.ts';

export const MAX_BACKUP_UPLOAD_BYTES = 5 * 1024 ** 3;
export const BACKUP_UPLOAD_CHUNK_BYTES = 16 * 1024 ** 2;
const MAX_EXPANDED_BYTES = 25 * 1024 ** 3;
const MAX_MEMBER_BYTES = 20 * 1024 ** 3;
const MAX_MEMBERS = 50_000;
const components = ['uploads', 'site-public', 'site-code'] as const;
const manifestSchema = z.object({
  version: z.literal(2),
  database: z.string().nullable(),
  includesDb: z.boolean(),
  includesFiles: z.boolean(),
  includesCode: z.boolean(),
  components: z.array(z.enum(components)).max(3),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

function archivePath(value: string) {
  const name = value.replace(/^(?:\.\/)+/, '').replace(/\/$/, '');
  if (name === '' || name === '.') return '';
  const parts = name.split('/');
  if (name.length > 1024 || /[\\:\x00-\x1f]/.test(name) || name.startsWith('/') || parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || isCredentialFile(p))) {
    throw new Error('The backup contains an unsafe file path.');
  }
  if (!(name === 'manifest.json' || name === 'database.sql' || name === 'files' || /^files\/(uploads|site-public|site-code)(\/|$)/.test(name))) {
    throw new Error('This is not a supported Nextract website backup.');
  }
  if (parts[1] === 'site-code' && parts.some(p => ['node_modules', '.next', 'dist', '.git', '.turbo'].includes(p))) {
    throw new Error('The backup contains generated or excluded source files.');
  }
  return name;
}

function textField(block: Buffer, start: number, length: number) {
  return block.subarray(start, start + length).toString('utf8').split('\0')[0];
}
function octal(block: Buffer, start: number, length: number) {
  const value = textField(block, start, length).trim();
  if (!/^[0-7]*$/.test(value)) throw new Error('Unsupported archive number format.');
  return value ? parseInt(value, 8) : 0;
}

function paxFields(bytes: Buffer) {
  const result: Record<string, string> = {};
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space < offset || space - offset > 8) throw new Error('Invalid archive metadata.');
    const length = Number(bytes.subarray(offset, space).toString());
    if (!Number.isSafeInteger(length) || length <= space - offset + 2 || offset + length > bytes.length || bytes[offset + length - 1] !== 10) throw new Error('Invalid archive metadata.');
    const entry = bytes.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = entry.indexOf('=');
    if (equals < 1) throw new Error('Invalid archive metadata.');
    const key = entry.slice(0, equals);
    if (!['path', 'size', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname', 'hdrcharset'].includes(key)) throw new Error('Unsupported archive metadata.');
    result[key] = entry.slice(equals + 1);
    offset += length;
  }
  return result;
}

/** Extracts only ordinary files/directories, with bounded gzip expansion and no links. */
export async function extractBackupArchive(archive: string, destination: string): Promise<BackupManifest> {
  const input = createReadStream(archive);
  const stream = createGunzip();
  input.on('error', error => stream.destroy(error));
  input.pipe(stream);
  const iterator = stream[Symbol.asyncIterator]();
  let pending = Buffer.alloc(0), expanded = 0;
  const read = async (size: number): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let remaining = size;
    while (remaining > 0) {
      if (!pending.length) {
        const next = await iterator.next();
        if (next.done) throw new Error('The backup archive is truncated.');
        pending = Buffer.from(next.value);
        expanded += pending.length;
        if (expanded > MAX_EXPANDED_BYTES) throw new Error('The expanded backup exceeds 25 GB.');
      }
      const take = Math.min(remaining, pending.length);
      chunks.push(pending.subarray(0, take)); pending = pending.subarray(take); remaining -= take;
    }
    return Buffer.concat(chunks, size);
  };
  const seen = new Set<string>();
  let pax: Record<string, string> = {}, count = 0;
  try {
    await mkdir(destination, { recursive: true, mode: 0o700 });
    while (true) {
      const header = await read(512);
      if (header.every(byte => byte === 0)) {
        if (!(await read(512)).every(byte => byte === 0)) throw new Error('Invalid archive ending.');
        if (pending.some(byte => byte !== 0)) throw new Error('Unexpected data after archive ending.');
        for await (const bytes of { [Symbol.asyncIterator]: () => iterator }) {
          expanded += bytes.length;
          if (expanded > MAX_EXPANDED_BYTES || bytes.some((byte: number) => byte !== 0)) throw new Error('Unexpected data after archive ending.');
        }
        break;
      }
      if (++count > MAX_MEMBERS) throw new Error('The backup contains too many entries.');
      const checksum = octal(header, 148, 8);
      const calculated = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
      if (checksum !== calculated) throw new Error('The backup archive header is damaged.');
      const type = textField(header, 156, 1);
      let size = octal(header, 124, 12);
      if (type === 'x' || type === 'g' || type === 'L') {
        if (size > 16_384 || Object.keys(pax).length) throw new Error('Invalid archive metadata.');
        const bytes = await read(size);
        if (type === 'L') pax = { path: bytes.toString('utf8').replace(/\0$/, '') };
        else {
          const fields = paxFields(bytes);
          if (type === 'g') {
            if ('path' in fields || 'size' in fields) throw new Error('Unsafe global archive metadata.');
          } else pax = fields;
        }
        if (size % 512) await read(512 - size % 512);
        continue;
      }
      if (!['', '0', '5'].includes(type)) throw new Error('Backups containing links or special files are not supported.');
      const prefix = textField(header, 345, 155);
      const name = archivePath(pax.path ?? `${prefix ? prefix + '/' : ''}${textField(header, 0, 100)}`);
      if (pax.size !== undefined) {
        if (!/^\d+$/.test(pax.size)) throw new Error('Invalid file size.');
        size = Number(pax.size);
      }
      pax = {};
      if (!Number.isSafeInteger(size) || size > MAX_MEMBER_BYTES || (type === '5' && size !== 0)) throw new Error('The backup contains an invalid or oversized file.');
      if (!name) { if (type !== '5') throw new Error('Invalid root entry.'); continue; }
      if (seen.has(name.toLowerCase())) throw new Error('The backup contains duplicate file paths.');
      seen.add(name.toLowerCase());
      if (name === 'manifest.json' && (type === '5' || size > 65_536)) throw new Error('Invalid backup manifest.');
      if (name === 'database.sql' && type === '5') throw new Error('The database backup must be a regular file.');
      if ((name === 'files' || /^files\/(uploads|site-public|site-code)$/.test(name)) && type !== '5') throw new Error('Backup components must be directories.');
      const target = path.resolve(destination, ...name.split('/'));
      if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error('Unsafe archive target.');
      if (type === '5') await mkdir(target, { recursive: true, mode: 0o700 });
      else {
        await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
        const file = await open(target, 'wx', 0o600);
        try {
          let remaining = size;
          while (remaining) {
            const bytes = await read(Math.min(remaining, 65_536));
            await file.writeFile(bytes); remaining -= bytes.length;
          }
        } finally { await file.close(); }
      }
      if (size % 512) await read(512 - size % 512);
    }
    if (Object.keys(pax).length) throw new Error('Incomplete archive metadata.');
    const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8')));
    if (!manifest.includesDb && !manifest.includesFiles && !manifest.includesCode) throw new Error('The backup contains no restorable content.');
    if (new Set(manifest.components).size !== manifest.components.length) throw new Error('Duplicate backup components.');
    if (manifest.includesDb !== seen.has('database.sql')) throw new Error('The database file does not match the backup manifest.');
    for (const component of components) {
      const present = [...seen].some(name => name === `files/${component}` || name.startsWith(`files/${component}/`));
      if (present !== manifest.components.includes(component)) throw new Error('Backup files do not match the manifest.');
    }
    if (manifest.includesFiles !== manifest.components.some(c => c !== 'site-code') || manifest.includesCode !== manifest.components.includes('site-code')) throw new Error('Backup options do not match the manifest.');
    return manifest;
  } finally { input.destroy(); stream.destroy(); }
}
