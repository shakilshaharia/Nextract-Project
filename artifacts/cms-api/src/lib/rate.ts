import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { env } from '../env.ts';
import { clientIp } from './http.ts';

const redis = env.RATE_LIMIT_REDIS_URL ? createClient({
  url: env.RATE_LIMIT_REDIS_URL,
  disableOfflineQueue: true,
  commandsQueueMaxLength: 1000,
  socket: { connectTimeout: 2000, reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 5000) },
}) : null;
redis?.on('error', () => console.error('[rate-limit] shared store unavailable'));
let connecting: Promise<unknown> | undefined;

export async function closeRateStore() {
  if (redis?.isOpen) redis.destroy();
}

export function limiter(options: { windowMinutes: number; limit: number; message: string }) {
  const namespace = createHash('sha256').update(JSON.stringify(options)).digest('hex').slice(0, 16);
  const store = redis ? new RedisStore({
    prefix: `nextract:limit:${namespace}:`,
    sendCommand: async (...args: string[]) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const command = async () => {
        if (!redis.isOpen) connecting ??= redis.connect().finally(() => { connecting = undefined; });
        if (connecting) await connecting;
        return redis.sendCommand(args) as Promise<import('rate-limit-redis').RedisReply>;
      };
      try {
        return await Promise.race([command(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Shared rate limiter timed out')), 2000); })]);
      } finally { clearTimeout(timer); }
    },
  }) : undefined;
  // The store eagerly loads Lua scripts. Observe startup failures even if no
  // request arrives; increment/get retry loading after the store recovers.
  void store?.incrementScriptSha.catch(() => undefined);
  void store?.getScriptSha.catch(() => undefined);
  return rateLimit({
    ...(store ? { store } : {}),
    passOnStoreError: false,
    windowMs: options.windowMinutes * 60 * 1000,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // ipKeyGenerator groups IPv6 addresses by /56 so one host cannot dodge the
    // limit by cycling through its own address block.
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
    message: { error: { message: options.message, code: 'rate_limited' } },
  });
}
