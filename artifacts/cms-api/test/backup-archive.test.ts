import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractBackupArchive } from '../src/lib/backup-archive.ts';

function tar(entries: { name: string; body?: string; type?: string }[]) {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100);
    header.write('0000600\0', 100);
    header.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
    header.fill(32, 148, 156);
    header.write(entry.type ?? '0', 156);
    header.write('ustar\0', 257);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
const manifest = { version: 2, database: null, includesDb: false, includesFiles: true, includesCode: false, components: ['uploads'] };
const base = [
  { name: './manifest.json', body: JSON.stringify(manifest) },
  { name: './files/uploads/photo.txt', body: 'original upload' },
];

test('standard tar.gz backup extracts ordinary files and validates the manifest', async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-archive-test-'));
  try {
    const archive = path.join(work, 'backup.tar.gz'); await writeFile(archive, tar(base));
    assert.deepEqual(await extractBackupArchive(archive, path.join(work, 'out')), manifest);
    assert.equal(await readFile(path.join(work, 'out/files/uploads/photo.txt'), 'utf8'), 'original upload');
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('uploaded archives reject traversal, links, credentials, duplicate paths and manifest mismatches', async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-archive-test-'));
  try {
    const invalid = [
      [...base, { name: '../outside', body: 'bad' }],
      [...base, { name: '/absolute', body: 'bad' }],
      [...base, { name: 'files/uploads/link', type: '2' }],
      [...base, { name: 'files/uploads/hardlink', type: '1' }],
      [...base, { name: 'files/uploads/.env', body: 'SECRET=bad' }],
      [...base, { name: 'files/uploads/PHOTO.txt', body: 'duplicate' }],
      [...base, { name: 'database.sql', body: 'unexpected sql' }],
      [base[0]],
      [{ name: 'manifest.json', body: '{}' }],
      [...base, { name: 'files/uploads/C:\\outside', body: 'bad' }],
      [...base, { name: 'files/site-code/node_modules/package', body: 'bad' }],
      [...base, { name: 'database.sql', type: '5' }],
      [...base, { name: 'files/uploads', body: 'not a directory' }],
    ];
    for (const [index, entries] of invalid.entries()) {
      const archive = path.join(work, `${index}.tar.gz`); await writeFile(archive, tar(entries));
      await assert.rejects(extractBackupArchive(archive, path.join(work, `out-${index}`)), `must reject case ${index}`);
    }
    const damaged = tar(base); damaged[damaged.length - 6] ^= 255;
    const archive = path.join(work, 'damaged.tar.gz'); await writeFile(archive, damaged);
    await assert.rejects(extractBackupArchive(archive, path.join(work, 'damaged')));
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('GNU long filenames are supported and still checked for traversal', async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), 'nx-archive-test-'));
  try {
    const name = `files/uploads/${'long-'.repeat(25)}.txt`;
    const entries = [base[0], { name: '././@LongLink', body: name + '\0', type: 'L' }, { name: 'placeholder', body: 'long filename' }];
    const archive = path.join(work, 'long.tar.gz'); await writeFile(archive, tar(entries));
    await extractBackupArchive(archive, path.join(work, 'out'));
    assert.equal(await readFile(path.join(work, 'out', name), 'utf8'), 'long filename');
    entries[1].body = '../outside\0';
    await writeFile(archive, tar(entries));
    await assert.rejects(extractBackupArchive(archive, path.join(work, 'bad')));
  } finally { await rm(work, { recursive: true, force: true }); }
});
