import { randomUUID } from 'node:crypto';
import type { Broadcast, Subscriber } from '../generated/prisma/client.ts';
import { db } from '../db.ts';
import { env } from '../env.ts';
import { sendMail, simpleHtml } from './mail.ts';
import { plainText, sanitizeWidgetHtml } from './sanitize.ts';
import { getSetting } from './settings.ts';
import { emitEvent } from './webhooks.ts';

const token = () => (randomUUID() + randomUUID()).replace(/-/g, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const asTags = (value: unknown): string[] => (Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : []);
const mergeTags = (existing: unknown, incoming: string[]) => Array.from(new Set([...asTags(existing), ...incoming])).slice(0, 50);

export type SubscribeResult = 'pending' | 'active' | 'already';

// Add or re-subscribe an email. With double opt-in on, a confirmation email is
// sent and the subscriber stays PENDING until they confirm.
export async function subscribe(email: string, name: string, tags: string[], source: string): Promise<SubscribeResult> {
  const normalized = email.trim().toLowerCase();
  const settings = await getSetting('newsletter');
  const existing = await db.subscriber.findUnique({ where: { email: normalized } });
  if (existing && existing.status === 'ACTIVE') {
    if (tags.length) await db.subscriber.update({ where: { id: existing.id }, data: { tags: mergeTags(existing.tags, tags) } });
    return 'already';
  }
  const unsubscribeToken = existing?.unsubscribeToken || token();

  if (settings.doubleOptIn) {
    const confirmToken = token();
    const subscriber = await db.subscriber.upsert({
      where: { email: normalized },
      update: { name: name || existing?.name || '', status: 'PENDING', confirmToken, tags: mergeTags(existing?.tags, tags) },
      create: { email: normalized, name, status: 'PENDING', confirmToken, unsubscribeToken, tags, source },
    });
    const url = `${env.siteUrl}/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;
    void sendMail({
      to: subscriber.email,
      subject: settings.confirmSubject,
      text: `${settings.confirmBody}\n\nConfirm: ${url}`,
      html: simpleHtml('Confirm your subscription', [settings.confirmBody], { label: 'Confirm subscription', url }),
    }).catch((e) => console.error('[newsletter] confirm email failed:', (e as Error).message));
    return 'pending';
  }

  const active = await db.subscriber.upsert({
    where: { email: normalized },
    update: { name: name || existing?.name || '', status: 'ACTIVE', confirmedAt: new Date(), confirmToken: null, tags: mergeTags(existing?.tags, tags) },
    create: { email: normalized, name, status: 'ACTIVE', confirmedAt: new Date(), unsubscribeToken, tags, source },
  });
  emitEvent('subscriber.created', { id: active.id, email: active.email, name: active.name, status: active.status, tags: asTags(active.tags), source: active.source });
  return 'active';
}

export async function confirmSubscriber(confirmToken: string): Promise<Subscriber | null> {
  const subscriber = await db.subscriber.findFirst({ where: { confirmToken } });
  if (!subscriber) return null;
  const confirmed = await db.subscriber.update({ where: { id: subscriber.id }, data: { status: 'ACTIVE', confirmedAt: new Date(), confirmToken: null } });
  emitEvent('subscriber.created', { id: confirmed.id, email: confirmed.email, name: confirmed.name, status: confirmed.status, tags: asTags(confirmed.tags), source: confirmed.source });
  return confirmed;
}

export async function unsubscribeByToken(unsubscribeToken: string): Promise<Subscriber | null> {
  const subscriber = await db.subscriber.findFirst({ where: { unsubscribeToken } });
  if (!subscriber) return null;
  const removed = await db.subscriber.update({ where: { id: subscriber.id }, data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() } });
  emitEvent('subscriber.unsubscribed', { id: removed.id, email: removed.email, name: removed.name });
  return removed;
}

function emailShell(broadcast: Broadcast, unsubscribeUrl: string, pixel: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5fa;font-family:Inter,Arial,sans-serif;color:#111114">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:14px;padding:28px">
    ${broadcast.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(broadcast.preheader)}</div>` : ''}
    <div style="font-size:15px;line-height:1.6">${sanitizeWidgetHtml(broadcast.bodyHtml)}</div>
    <hr style="border:none;border-top:1px solid #ececf0;margin:24px 0" />
    <p style="font-size:12px;color:#8a8a93;text-align:center">
      You received this because you subscribed. <a href="${unsubscribeUrl}" style="color:#8a8a93">Unsubscribe</a>.
    </p>
  </div>${pixel}</body></html>`;
}

// Sends a broadcast to ACTIVE subscribers matching its audience tags (empty =
// everyone). Processes in order with a gentle delay and keeps stats current.
export async function sendBroadcast(id: string): Promise<void> {
  const broadcast = await db.broadcast.findUnique({ where: { id } });
  if (!broadcast || broadcast.status === 'SENDING' || broadcast.status === 'SENT') return;
  const audience = asTags(broadcast.audienceTags);
  const all = await db.subscriber.findMany({ where: { status: 'ACTIVE' } });
  const recipients = audience.length ? all.filter((s) => asTags(s.tags).some((t) => audience.includes(t))) : all;

  const claim = await db.broadcast.updateMany({ where: { id, status: { in: ['DRAFT', 'SCHEDULED'] } }, data: { status: 'SENDING', recipients: recipients.length, sent: 0, failed: 0 } });
  if (!claim.count) return;
  let sent = 0;
  let failed = 0;
  for (const subscriber of recipients) {
    try {
      const unsubscribeUrl = `${env.siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
      const pixel = `<img src="${env.siteUrl}/api/public/newsletter/open/${broadcast.id}/${subscriber.id}" width="1" height="1" alt="" style="display:none" />`;
      await sendMail({
        to: subscriber.email,
        subject: broadcast.subject,
        html: emailShell(broadcast, unsubscribeUrl, pixel),
        text: `${plainText(broadcast.bodyHtml)}\n\nUnsubscribe: ${unsubscribeUrl}`,
      });
      sent++;
    } catch {
      failed++;
    }
    if ((sent + failed) % 10 === 0) await db.broadcast.update({ where: { id }, data: { sent, failed } }).catch(() => undefined);
    await sleep(40);
  }
  await db.broadcast.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), sent, failed } });
  emitEvent('broadcast.sent', { id: broadcast.id, subject: broadcast.subject, recipients: recipients.length, sent, failed });
}

// Called by the scheduler: send any broadcasts whose scheduled time has passed.
export async function sendDueBroadcasts(): Promise<void> {
  const now = new Date();
  const due = await db.broadcast.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } });
  for (const b of due) await sendBroadcast(b.id);
}
