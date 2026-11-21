import { createApp } from './app.ts';
import { db } from './db.ts';
import { env } from './env.ts';
import { reconcileStuckBackups } from './lib/backup.ts';
import { startScheduler } from './lib/scheduler.ts';
import { closeRateStore } from './lib/rate.ts';

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`[api] listening on http://${env.HOST}:${env.PORT}  (${env.NODE_ENV})`);
});

// Clear any backup left "running" by a previous process (crash/restart).
void reconcileStuckBackups().catch((error) => console.warn('[backup] reconcile:', (error as Error).message));

const stopScheduler = startScheduler();

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  stopScheduler();
  server.close(async () => {
    await closeRateStore();
    await db.$disconnect();
    process.exit(0);
  });
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
