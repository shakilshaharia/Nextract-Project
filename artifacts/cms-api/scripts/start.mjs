// Run the whole website as one Node.js app, the way production does:
// website, /admin dashboard and API all on a single port.
//
//   pnpm build:cms                    (once, and after every change)
//   pnpm start:cms                    http://localhost:3000
//   PORT=3005 pnpm start:cms          if 3000 is taken
//
// Locally it also starts the dev database; on a server with a real
// DATABASE_URL, run `node --env-file=.env dist/index.mjs` directly.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const apiDir = path.resolve(import.meta.dirname, '..');
const siteDir = path.resolve(apiDir, '..', 'nextract');
const adminDist = path.resolve(apiDir, '..', 'cms-admin', 'dist');
const node = process.execPath;

const missing = [
  [path.join(apiDir, 'dist', 'index.mjs'), 'API'],
  [path.join(siteDir, '.next', 'BUILD_ID'), 'website'],
  [path.join(adminDist, 'index.html'), 'admin'],
].filter(([file]) => !existsSync(file));
if (missing.length) {
  console.error(`[start] no build found for: ${missing.map(([, name]) => name).join(', ')}. Run \`pnpm build:cms\` first.`);
  process.exit(1);
}

// Schema changes are a separate reviewed release step, never a side effect of
// starting/restarting the app. Run the documented db:deploy command explicitly.

const sitePort = process.env.SITE_PORT ?? '3000';
const apiPort = process.env.API_PORT ?? '4000';
const siteUrl = `http://localhost:${sitePort}`;
const apiUrl = `http://localhost:${apiPort}`;
const api = spawn(node, ['--env-file-if-exists=.env', 'dist/index.mjs'], {
  cwd: apiDir,
  stdio: 'inherit',
  // Real environment variables win over .env.
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: apiPort,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? siteUrl,
    ADMIN_URL: process.env.ADMIN_URL ?? `${apiUrl}/admin`,
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? '',
    SITE_DIST: '',
    ADMIN_DIST: adminDist,
  },
});

const site = spawn(node, [path.join(siteDir, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', sitePort, '-H', '127.0.0.1'], {
  cwd: siteDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', CMS_API_URL: apiUrl },
});

console.log(`\n  Website  ${siteUrl}\n  Admin    ${apiUrl}/admin\n  API      ${apiUrl}/api/health\n`);

const stop = () => { api.kill(); site.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (code) => { site.kill(); process.exit(code ?? 0); });
site.on('exit', (code) => { api.kill(); process.exit(code ?? 0); });
