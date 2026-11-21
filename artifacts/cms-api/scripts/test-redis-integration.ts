// Uses a dedicated real Redis executable, private ephemeral port and temp path.
// Never connects to an existing Redis instance or modifies application config.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';

assert.notEqual(process.env.NODE_ENV, 'production');
const executable = process.env.REDIS_SERVER_BIN;
assert.ok(executable && existsSync(executable), 'Set REDIS_SERVER_BIN to a verified local Redis executable.');
const root = await mkdtemp(path.join(os.tmpdir(), 'nx-redis-test-'));
assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
const reservation = createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening');
const address = reservation.address(); assert.ok(address && typeof address !== 'string');
const port = address.port; await new Promise<void>((resolve) => reservation.close(() => resolve()));
const url = `redis://127.0.0.1:${port}`;
const workers: ChildProcess[] = [];
let redisServer: ChildProcess | undefined;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'close'); child.kill(); await closed;
}
async function waitForPort() {
  for (let n = 0; n < 40; n++) {
    const up = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(250);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false)); socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (up) return;
    if (redisServer?.exitCode !== null) throw new Error('The isolated Redis process exited before readiness.');
    await delay(100);
  }
  throw new Error('Isolated Redis did not become ready.');
}
async function startRedis() {
  redisServer = spawn(executable!, ['--bind', '127.0.0.1', '--port', String(port), '--protected-mode', 'yes', '--save', '', '--appendonly', 'no', '--maxmemory', '32mb', '--maxmemory-policy', 'noeviction', '--dir', root], { cwd: path.dirname(executable!), windowsHide: true, stdio: 'ignore' });
  redisServer.once('error', () => { /* readiness check reports a bounded failure */ });
  await waitForPort();
  const client = createClient({ url, socket: { reconnectStrategy: false, connectTimeout: 1000 } }); client.on('error', () => undefined);
  try { await client.connect(); assert.equal(await client.ping(), 'PONG'); }
  finally { if (client.isOpen) client.destroy(); }
}
async function worker() {
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./security-rate-worker.ts', import.meta.url))], { cwd: process.cwd(), env: { ...process.env, RATE_LIMIT_REDIS_URL: url }, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  workers.push(child);
  const result = await Promise.race([
    once(child, 'message').then(([message]) => message as { port: number }),
    once(child, 'exit').then(() => { throw new Error('Rate-limit test worker exited before readiness.'); }),
    new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('Rate-limit worker readiness timed out.')), 10_000); timer.unref(); }),
  ]);
  return { child, base: `http://127.0.0.1:${result.port}` };
}
const status = async (base: string) => (await fetch(`${base}/limited`, { signal: AbortSignal.timeout(7000) })).status;

try {
  await startRedis();
  let a = await worker(); const b = await worker();
  assert.equal(await status(a.base), 200); assert.equal(await status(b.base), 200);
  assert.deepEqual((await Promise.all([status(a.base), status(b.base)])).sort(), [200, 429], 'Workers must share one atomic budget');
  await stop(a.child); a = await worker();
  assert.equal(await status(a.base), 429, 'Restarting the app must not reset Redis limits');
  await stop(redisServer); redisServer = undefined;
  assert.equal(await status(a.base), 500, 'Store outages must refuse limited requests');
  assert.equal((await fetch(`${a.base}/health`)).status, 200);
  await startRedis();
  let recovered = false;
  for (let n = 0; n < 15; n++) { if (await status(a.base) === 200) { recovered = true; break; } await delay(500); }
  assert.equal(recovered, true, 'Workers should reconnect after Redis recovery');
  console.log('PASS: real Redis, cross-process atomic limits, app-restart persistence, bounded failure refusal and reconnection. Dedicated Redis process and data directory only.');
} finally {
  for (const child of workers) await stop(child);
  await stop(redisServer);
  await rm(root, { recursive: true, force: true });
}
