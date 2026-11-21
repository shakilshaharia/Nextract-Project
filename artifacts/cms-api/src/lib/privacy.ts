import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { db } from '../db.ts';
import { consentChoicesSchema, type ConsentChoices } from '@workspace/cms-content';
import { env } from '../env.ts';
import { getActiveSnippets } from './content.ts';
import { getSetting } from './settings.ts';

export const CONSENT_COOKIE = 'nextract_consent_id';
export const rejectOptional: ConsentChoices = { essential: true, functional: false, analytics: false, marketing: false };
export const acceptAll: ConsentChoices = { essential: true, functional: true, analytics: true, marketing: true };

export function signVisitorId(id: string): string {
  return `${id}.${createHmac('sha256', env.APP_SECRET).update(id).digest('hex')}`;
}

export function visitorIdFromCookie(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const [id, signature] = value.split('.');
  if (!/^[0-9a-f-]{36}$/.test(id ?? '') || !/^[0-9a-f]{64}$/.test(signature ?? '')) return null;
  const expected = Buffer.from(signVisitorId(id).split('.')[1], 'hex');
  const actual = Buffer.from(signature, 'hex');
  return timingSafeEqual(expected, actual) ? id : null;
}

export function newVisitorId() { return randomUUID(); }

export function countryFromRequest(req: Request): string {
  const peer = req.socket.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return '';
  const country = req.headers['cf-ipcountry'];
  return typeof country === 'string' && /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : '';
}

const EUROPE = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB'.split(' '));
export function regionFor(country: string): 'canada' | 'europe' | 'global' {
  return country === 'CA' ? 'canada' : EUROPE.has(country) ? 'europe' : 'global';
}

// A change to policy copy, links, tracker IDs, script fields, or an active
// snippet invalidates old decisions automatically. The manual policyVersion
// lets editors request re-consent for a legal policy update with no code change.
export async function currentPolicy() {
  const [privacy, site, snippets] = await Promise.all([getSetting('privacy'), getSetting('site'), getActiveSnippets()]);
  const source = {
    privacy, trackers: [site.googleAnalyticsId, site.googleTagManagerId],
    scripts: [site.headerScripts, site.footerScripts, site.headerScriptsCategory, site.footerScriptsCategory],
    snippets: snippets.map((s) => [s.id, s.code, s.consentCategory, s.location, s.scope, s.paths]),
  };
  const version = createHash('sha256').update(JSON.stringify(source)).digest('hex');
  return { privacy, version };
}

export function validChoices(value: unknown): ConsentChoices | null {
  const result = consentChoicesSchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function choicesForRequest(req: Request): Promise<ConsentChoices> {
  const visitorId = visitorIdFromCookie(req.cookies?.[CONSENT_COOKIE]);
  if (!visitorId) return rejectOptional;
  const [policy, latest] = await Promise.all([
    currentPolicy(), db.consentRecord.findFirst({ where: { visitorId }, orderBy: { createdAt: 'desc' } }),
  ]);
  return latest?.policyVersion === policy.version ? validChoices(latest.choices) ?? rejectOptional : rejectOptional;
}
