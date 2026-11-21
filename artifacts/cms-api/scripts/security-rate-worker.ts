// Child process used only by the isolated real-Redis integration test.
import express from 'express';
import { limiter, closeRateStore } from '../src/lib/rate.ts';
import { errorHandler } from '../src/lib/http.ts';

const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/limited', limiter({ windowMinutes: 1, limit: 3, message: 'isolated shared-store test' }), (_req, res) => res.json({ ok: true }));
app.use(errorHandler);
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.send?.({ port: address.port });
});
process.on('SIGTERM', () => server.close(() => { void closeRateStore().finally(() => process.exit(0)); }));
