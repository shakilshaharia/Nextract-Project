import { readdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const excluded = new Set(['node_modules','.git','.next','dist','generated','uploads','backups','dev-mail','.cache','.turbo','test-results','playwright-report']);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(full); continue; }
    if (entry.name === '.dev-credentials' || (entry.name.startsWith('.env') && entry.name !== '.env.example') || /\.(pem|key|p12|pfx|log|tsbuildinfo|zip|gz|enc)$/i.test(entry.name)) continue;
    if (entry.name.endsWith('.sql') && !full.includes(path.join('prisma','migrations') + path.sep)) continue;
    files.push(path.relative(root, full).replaceAll('\\','/'));
  }
}
await walk(root);
const archive = path.join(os.tmpdir(), 'nextract-release-20261108.tar.gz');
const manifest = path.join(os.tmpdir(), 'nextract-release-20261108.files');
await writeFile(manifest, files.join('\0') + '\0');
const result = spawnSync('tar', ['-czf', archive, '--null', '-T', manifest], { cwd: root, windowsHide: true, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr);
console.log(JSON.stringify({ archive, files: files.length, bytes: (await stat(archive)).size, sha256: createHash('sha256').update(await readFile(archive)).digest('hex') }));
