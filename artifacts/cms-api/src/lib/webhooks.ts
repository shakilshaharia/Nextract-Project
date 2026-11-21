// Outbound webhooks / integrations. When a CMS event fires, every enabled
// webhook subscribed to it gets a signed POST. Deliveries are logged and
// retried with backoff by the scheduler. Destination URLs are SSRF-guarded
// both when saved and again immediately before each send.

import { createHmac, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { WebhookEvent } from '@workspace/cms-content';
import { db } from '../db.ts';
import type { Prisma, Webhook, WebhookDelivery } from '../generated/prisma/client.ts';

export const MAX_ATTEMPTS = 5;
const SEND_TIMEOUT_MS = 8_000;
const RESPONSE_CAP = 2_000;
// Minutes to wait before the Nth retry (index = attempts already made).
const BACKOFF_MIN = [2, 5, 15, 60, 180];

// --- Signing -------------------------------------------------------------

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export function newSecret(): string {
  return (randomUUID() + randomUUID()).replace(/-/g, '');
}

// --- SSRF guard ----------------------------------------------------------

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToLong(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved / broadcast
  );
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // strip zone id
  if (addr === '::1' || addr === '::' || addr === '') return true;
  // URL parsing normalizes mapped dotted IPv4 to hex (::ffff:7f00:1).
  const mapped = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const n = (parseInt(mapped[1], 16) << 16) | parseInt(mapped[2], 16);
    return isPrivateIpv4(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
  }
  const first = addr.split(':')[0] || '';
  const head = parseInt(first || '0', 16);
  if (Number.isNaN(head)) return true;
  // Accept only global unicast (2000::/3), excluding documentation space.
  if ((head & 0xe000) !== 0x2000) return true;
  if (addr.startsWith('2001:db8:') || addr === '2001:db8::') return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true;
}

/**
 * Throws if `raw` is not a safe public http(s) destination. Rejects non-http
 * schemes, embedded credentials, and any host that resolves to a private,
 * loopback, link-local or reserved address (blocks cloud metadata + internal
 * services). Resolves DNS and checks every returned address.
 */
export async function resolvePublicUrl(raw: string): Promise<{ url: URL; address: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http:// and https:// URLs are allowed.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host.toLowerCase() === 'localhost' || host.toLowerCase().endsWith('.localhost')) throw new Error('This host is not allowed.');

  // If the host is already a literal IP, check it directly; otherwise resolve.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('This address is not allowed.');
    return { url, address: host };
  }
  let addresses: { address: string }[];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out')), 2000); }),
    ]);
  } catch {
    throw new Error('That host could not be resolved.');
  } finally { clearTimeout(timer); }
  if (addresses.length === 0) throw new Error('That host could not be resolved.');
  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error('This host resolves to a private or reserved address.');
  }
  return { url, address: addresses[0].address };
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  return (await resolvePublicUrl(raw)).url;
}

// --- Payloads ------------------------------------------------------------

type EventData = Record<string, unknown>;

function slackText(event: WebhookEvent, data: EventData): string {
  switch (event) {
    case 'form.submission':
      return `📝 New form submission${data.formName ? ` on *${String(data.formName)}*` : ''}${data.email ? ` from ${String(data.email)}` : ''}.`;
    case 'subscriber.created':
      return `📨 New newsletter subscriber: ${String(data.email ?? 'unknown')}${data.status ? ` (${String(data.status)})` : ''}.`;
    case 'subscriber.unsubscribed':
      return `👋 ${String(data.email ?? 'A subscriber')} unsubscribed from the newsletter.`;
    case 'broadcast.sent':
      return `✅ Broadcast *${String(data.subject ?? '')}* sent to ${Number(data.sent ?? 0)} subscriber(s).`;
    case 'page.published':
      return `🌐 Page published: *${String(data.title ?? '')}*${data.url ? ` (${String(data.url)})` : ''}.`;
    case 'post.published':
      return `📰 Blog post published: *${String(data.title ?? '')}*.`;
    default:
      return `Nextract event: ${event}`;
  }
}

// --- Delivery ------------------------------------------------------------

function nextBackoff(attempts: number): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const minutes = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] ?? 60;
  return new Date(Date.now() + minutes * 60_000);
}

export type SendResult = { ok: boolean; statusCode: number | null; response: string; error: string };

// Builds the body + headers for a webhook and POSTs it. Production callers
// pass the address checked by resolvePublicUrl, pinning the connection against
// DNS rebinding. The unpinned form is used by local transport tests only.
export async function postWebhook(
  opts: { url: string; format: 'JSON' | 'SLACK'; secret: string; event: string; deliveryId: string; payload: EventData },
  pinnedAddress?: string,
): Promise<SendResult> {
  const body =
    opts.format === 'SLACK'
      ? JSON.stringify({ text: slackText(opts.event as WebhookEvent, (opts.payload.data as EventData) ?? opts.payload) })
      : JSON.stringify(opts.payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Nextract-Webhooks/1.0',
    'x-nextract-event': opts.event,
    'x-nextract-delivery': opts.deliveryId,
  };
  if (opts.format === 'JSON') headers['x-nextract-signature'] = signPayload(opts.secret, body);

  return new Promise((resolve) => {
    const url = new URL(opts.url);
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(url, {
      method: 'POST', headers, signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      ...(pinnedAddress ? { lookup: (_hostname: string, options: { all?: boolean }, callback: (error: Error | null, address: string | { address: string; family: number }[], family?: number) => void) => {
        const family = isIP(pinnedAddress);
        if (options.all) callback(null, [{ address: pinnedAddress, family }]);
        else callback(null, pinnedAddress, family);
      } } : {}),
    }, (res) => {
      let response = '';
      let received = 0;
      const complete = () => {
        const statusCode = res.statusCode ?? 0;
        const ok = statusCode >= 200 && statusCode < 300;
        resolve({ ok, statusCode, response, error: ok ? '' : `Endpoint returned HTTP ${statusCode}.` });
      };
      res.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (response.length < RESPONSE_CAP) response += chunk.toString().slice(0, RESPONSE_CAP - response.length);
        if (received >= RESPONSE_CAP) { complete(); res.destroy(); }
      });
      res.on('end', complete);
      res.on('error', () => resolve({ ok: false, statusCode: res.statusCode ?? null, response: '', error: 'Endpoint response was interrupted.' }));
    });
    req.on('error', (cause: Error) => resolve({ ok: false, statusCode: null, response: '', error: cause.message }));
    req.end(body);
  });
}

// Claim a due row atomically. A one-minute lease makes an interrupted send
// eligible again after restart; the network timeout is eight seconds.
export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } });
  if (!delivery || !delivery.webhook.enabled) return;
  const claimed = await db.webhookDelivery.updateMany({
    where: { id: deliveryId, webhook: { enabled: true }, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS }, nextAttempt: { lte: new Date() } },
    data: { attempts: { increment: 1 }, nextAttempt: new Date(Date.now() + 60_000) },
  });
  if (!claimed.count) return;
  const webhook = delivery.webhook;
  const attempts = delivery.attempts + 1;

  let result: SendResult;
  try {
    const destination = await resolvePublicUrl(webhook.url);
    result = await postWebhook({ url: webhook.url, format: webhook.format, secret: webhook.secret, event: delivery.event, deliveryId: delivery.id, payload: delivery.payload as EventData }, destination.address);
  } catch (cause) {
    result = { ok: false, statusCode: null, response: '', error: cause instanceof Error ? cause.message : 'Delivery failed.' };
  }
  const { ok, statusCode, response: responseText, error } = result;

  await db.webhookDelivery.update({
    where: { id: delivery.id },
    data: ok
      ? { status: 'SUCCESS', statusCode, response: responseText, error: '', attempts, nextAttempt: null, deliveredAt: new Date() }
      : { status: 'FAILED', statusCode, response: responseText, error: error.slice(0, 1000), attempts, nextAttempt: nextBackoff(attempts) },
  });
}

// --- Dispatch ------------------------------------------------------------

// Fire an event to every enabled webhook subscribed to it. Non-blocking: rows
// are created PENDING and sent in the background so the request isn't delayed.
export async function dispatchEvent(event: WebhookEvent, data: EventData): Promise<void> {
  let hooks: Webhook[];
  try {
    hooks = await db.webhook.findMany({ where: { enabled: true } });
  } catch {
    return; // never let webhook wiring break the triggering request
  }
  const subscribed = hooks.filter((h) => Array.isArray(h.events) && (h.events as string[]).includes(event));
  if (subscribed.length === 0) return;

  const payload = { event, id: randomUUID(), createdAt: new Date().toISOString(), data };
  for (const hook of subscribed) {
    try {
      const delivery = await db.webhookDelivery.create({
        data: { webhookId: hook.id, event, payload: payload as unknown as Prisma.InputJsonValue, response: '', status: 'PENDING', nextAttempt: new Date() },
      });
      void deliverWebhook(delivery.id).catch(() => undefined);
    } catch {
      // ignore a single webhook's failure to enqueue
    }
  }
}

// Convenience wrapper so callers don't await or handle errors inline.
export function emitEvent(event: WebhookEvent, data: EventData): void {
  void dispatchEvent(event, data).catch(() => undefined);
}

// --- Scheduler hook ------------------------------------------------------

// Retries deliveries whose backoff is due (and sweeps up any PENDING rows the
// immediate fire didn't resolve, e.g. after a restart).
export async function processDueWebhooks(now = new Date()): Promise<number> {
  let due: WebhookDelivery[];
  try {
    due = await db.webhookDelivery.findMany({
      where: { webhook: { enabled: true }, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS }, nextAttempt: { lte: now } },
      orderBy: { nextAttempt: 'asc' },
      take: 25,
    });
  } catch {
    return 0;
  }
  for (const delivery of due) await deliverWebhook(delivery.id);
  return due.length;
}
