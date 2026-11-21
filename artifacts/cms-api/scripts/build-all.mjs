// Production build of the whole CMS stack, in order:
//   website → artifacts/nextract/.next
//   admin   → artifacts/cms-admin/dist
//   API     → artifacts/cms-api/dist/index.mjs
//
//   pnpm build:cms        (from the workspace root)

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
// Run pnpm's own script with this Node when started through pnpm; otherwise
// fall back to the pnpm on PATH.
const pnpmJs = process.env.npm_execpath;
const command = pnpmJs ? process.execPath : 'pnpm';
const prefix = pnpmJs ? [pnpmJs] : [];

const steps = [
  ['nextract', {}],
  ['@workspace/cms-admin', {}],
  ['@workspace/cms-api', {}],
];

for (const [name, env] of steps) {
  console.log(`\n[build-all] ${name}`);
  const result = spawnSync(command, [...prefix, '--filter', name, 'run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: !pnpmJs && process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'production', ...env },
  });
  if (result.status !== 0) {
    console.error(`[build-all] ${name} failed`);
    process.exit(result.status ?? 1);
  }
}
console.log('\n[build-all] done. Start with: cd artifacts/cms-api && pnpm start');
