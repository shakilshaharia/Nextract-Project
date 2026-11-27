// Uptime monitoring. Runs inside the API process once a minute (from the
// scheduler). When the watched URL fails a few checks in a row it emails the
// recipients configured in Security settings, and again when it recovers.
//
// Note: this runs in the API process, so it reliably catches the public site
// (Next.js) or an external URL going down while the API is alive. It cannot
// alert if the API process itself is down — the external cron watchdog on the
// server remains the backstop for that case.

import type { SecuritySettings } from '@workspace/cms-content';
import { env } from '../env.ts';
import { sendMail, simpleHtml } from './mail.ts';
import { getSetting } from './settings.ts';

type MonitorConfig = SecuritySettings['uptimeMonitor'];

type MonitorState = {
  status: 'up' | 'down' | 'unknown';
  fails: number;
  lastNotify: number;
  lastCheckedAt: number;
  lastCode: number;
};

const state: MonitorState = { status: 'unknown', fails: 0, lastNotify: 0, lastCheckedAt: 0, lastCode: 0 };

export function getUptimeStatus() {
  return {
    status: state.status,
    lastCheckedAt: state.lastCheckedAt ? new Date(state.lastCheckedAt).toISOString() : null,
    lastCode: state.lastCode || null,
  };
}

function targetUrl(cfg: MonitorConfig): string {
  return cfg.url || env.siteUrl;
}

async function probe(url: string): Promise<{ ok: boolean; code: number }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'Nextract-UptimeMonitor/1.0' },
    });
    return { ok: res.status >= 200 && res.status < 400, code: res.status };
  } catch {
    return { ok: false, code: 0 };
  }
}

async function notify(subject: string, lines: string[], recipients: string[]) {
  await sendMail({ to: recipients.join(', '), subject, text: lines.join('\n'), html: simpleHtml(subject, lines) });
}

// One monitoring tick. Called by the scheduler every minute.
export async function runUptimeMonitor(now = Date.now()) {
  const { uptimeMonitor: cfg } = await getSetting('security');
  if (!cfg.enabled || cfg.recipients.length === 0) {
    state.status = 'unknown';
    return;
  }

  const url = targetUrl(cfg);
  const { ok, code } = await probe(url);
  state.lastCheckedAt = now;
  state.lastCode = code;
  const stamp = new Date(now).toISOString();

  if (!ok) {
    state.fails += 1;
    if (state.status !== 'down' && state.fails >= cfg.failThreshold) {
      state.status = 'down';
      state.lastNotify = now;
      try {
        await notify(`[Nextract] DOWN — ${url}`, [
          'Nextract appears to be DOWN.',
          '',
          `URL: ${url}`,
          `HTTP status: ${code || 'no response'}`,
          `Consecutive failed checks: ${state.fails}`,
          `Time: ${stamp}`,
          '',
          "You'll get a recovery email when it is reachable again.",
        ], cfg.recipients);
      } catch (error) {
        console.error('[uptime] DOWN alert email failed:', (error as Error).message);
      }
    } else if (state.status === 'down' && now - state.lastNotify >= cfg.remindMinutes * 60_000) {
      state.lastNotify = now;
      try {
        await notify(`[Nextract] STILL DOWN — ${url}`, [
          'Nextract is still DOWN.',
          '',
          `URL: ${url}`,
          `HTTP status: ${code || 'no response'}`,
          `Time: ${stamp}`,
        ], cfg.recipients);
      } catch (error) {
        console.error('[uptime] reminder email failed:', (error as Error).message);
      }
    }
  } else {
    if (state.status === 'down') {
      try {
        await notify(`[Nextract] RECOVERED — ${url}`, [
          'Nextract is back UP.',
          '',
          `URL: ${url}`,
          `HTTP status: ${code}`,
          `Time: ${stamp}`,
        ], cfg.recipients);
      } catch (error) {
        console.error('[uptime] recovery email failed:', (error as Error).message);
      }
    }
    state.status = 'up';
    state.fails = 0;
  }
}

// Sends a one-off test alert to the given recipients (the "Send test alert"
// button). Throws nodemailer's error so the admin sees exactly what failed.
export async function sendUptimeTest(recipients: string[]) {
  const url = (await getSetting('security')).uptimeMonitor.url || env.siteUrl;
  await notify('[Nextract] Uptime monitor test', [
    'This is a test alert from your Nextract uptime monitor.',
    '',
    `If ${url} goes down, this is who gets notified — and again when it recovers.`,
    `Time: ${new Date().toISOString()}`,
  ], recipients);
}
