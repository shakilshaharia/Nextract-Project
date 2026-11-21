import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { assertPublicUrl, newSecret, postWebhook, signPayload } from '../src/lib/webhooks.ts';

test('signPayload is an HMAC-SHA256 the receiver can reproduce', () => {
  const secret = 'shhh';
  const body = JSON.stringify({ event: 'test', n: 1 });
  const sig = signPayload(secret, body);
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(sig, expected);
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
});

test('newSecret is a long random hex string', () => {
  const a = newSecret();
  const b = newSecret();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('SSRF guard rejects non-http schemes and embedded credentials', async () => {
  await assert.rejects(() => assertPublicUrl('ftp://example.com/x'), /http/);
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd'), /http/);
  await assert.rejects(() => assertPublicUrl('https://user:pass@example.com'), /credentials/);
  await assert.rejects(() => assertPublicUrl('not a url'), /valid URL/);
});

test('SSRF guard rejects loopback, private and reserved hosts (no DNS needed for literal IPs)', async () => {
  await assert.rejects(() => assertPublicUrl('http://localhost/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://127.0.0.1/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://10.0.0.5/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://192.168.1.1/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://172.16.0.1/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://169.254.169.254/latest/meta-data'), /not allowed/); // cloud metadata
  await assert.rejects(() => assertPublicUrl('http://[::1]/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://[::ffff:127.0.0.1]/hook'), /not allowed/);
  await assert.rejects(() => assertPublicUrl('http://[::ffff:10.0.0.1]/hook'), /not allowed/);
});

test('SSRF guard allows a public literal IP', async () => {
  const url = await assertPublicUrl('https://8.8.8.8/webhook');
  assert.equal(url.hostname, '8.8.8.8');
});

test('postWebhook POSTs a correctly-signed JSON body that the receiver can verify', async () => {
  const received: { body: string; sig: string | undefined; event: string | undefined } = { body: '', sig: undefined, event: undefined };
  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      received.body = data;
      received.sig = req.headers['x-nextract-signature'] as string | undefined;
      received.event = req.headers['x-nextract-event'] as string | undefined;
      res.statusCode = 200;
      res.end('ok');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const secret = newSecret();
  try {
    const payload = { event: 'subscriber.created', id: 'abc', createdAt: new Date().toISOString(), data: { email: 'x@y.com' } };
    const result = await postWebhook({ url: `http://127.0.0.1:${port}/hook`, format: 'JSON', secret, event: 'subscriber.created', deliveryId: 'd1', payload });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.statusCode, 200);
    assert.equal(received.event, 'subscriber.created');
    // The receiver reproduces the signature from the raw body + shared secret.
    assert.equal(received.sig, `sha256=${createHmac('sha256', secret).update(received.body).digest('hex')}`);
    assert.deepEqual(JSON.parse(received.body), payload);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('postWebhook sends Slack format as { text } with no signature header', async () => {
  const received: { body: string; sig: string | undefined } = { body: '', sig: undefined };
  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { received.body = data; received.sig = req.headers['x-nextract-signature'] as string | undefined; res.statusCode = 200; res.end('ok'); });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  try {
    const payload = { event: 'broadcast.sent', id: 'b', createdAt: '', data: { subject: 'Hi', sent: 5 } };
    const result = await postWebhook({ url: `http://127.0.0.1:${port}/slack`, format: 'SLACK', secret: 's', event: 'broadcast.sent', deliveryId: 'd2', payload });
    assert.equal(result.ok, true);
    assert.equal(received.sig, undefined);
    const parsed = JSON.parse(received.body) as { text: string };
    assert.match(parsed.text, /Hi/);
    assert.match(parsed.text, /5/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('postWebhook connects to the checked address while preserving the destination host', async () => {
  let host = '';
  const server = createServer((req, res) => { host = req.headers.host ?? ''; res.end('ok'); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  try {
    const result = await postWebhook({ url: `http://receiver.invalid:${port}/hook`, format: 'JSON', secret: 's', event: 'test.ping', deliveryId: 'd3', payload: {} }, '127.0.0.1');
    assert.equal(result.ok, true, result.error);
    assert.equal(host, `receiver.invalid:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
