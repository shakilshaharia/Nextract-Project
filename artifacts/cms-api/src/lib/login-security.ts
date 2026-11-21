import type { Request } from 'express';
import type { SecuritySettings } from '@workspace/cms-content';
import { env } from '../env.ts';
import { clientIp, HttpError } from './http.ts';
import { getSetting } from './settings.ts';
import { decryptSecret, encryptSecret } from './totp.ts';

const SEALED_PREFIX = 'sealed:v1:';

export function sealLoginRecaptchaSecret(secret: string) {
  return `${SEALED_PREFIX}${encryptSecret(secret)}`;
}

function openLoginRecaptchaSecret(stored: string) {
  return stored.startsWith(SEALED_PREFIX) ? decryptSecret(stored.slice(SEALED_PREFIX.length)) : stored;
}

export function adminBasePath(security: Pick<SecuritySettings, 'adminPath'>) {
  return security.adminPath ? `/admin/${security.adminPath}` : '/admin';
}

export async function configuredAdminUrl(suffix = '') {
  const security = await getSetting('security');
  return `${new URL(env.adminUrl).origin}${adminBasePath(security)}${suffix}`;
}

export function publicLoginSecurity(security: Pick<SecuritySettings, 'loginRecaptchaEnabled' | 'loginRecaptchaSiteKey' | 'loginRecaptchaSecret'>) {
  const recaptchaEnabled = Boolean(security.loginRecaptchaEnabled && security.loginRecaptchaSiteKey && security.loginRecaptchaSecret);
  return { recaptchaEnabled, recaptchaSiteKey: recaptchaEnabled ? security.loginRecaptchaSiteKey : '' };
}

export async function verifyLoginRecaptcha(token: string | undefined, req: Request, loginEmail: string) {
  // Reauthentication inside an existing admin session remains usable without
  // another CAPTCHA. Anonymous password attempts must solve it when enabled.
  if (req.user?.email.toLowerCase() === loginEmail.toLowerCase()) return;
  const security = await getSetting('security');
  const config = publicLoginSecurity(security);
  if (!config.recaptchaEnabled) return;
  if (!token) throw new HttpError(400, 'Please complete the reCAPTCHA verification.', 'captcha');

  const result = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    signal: AbortSignal.timeout(5000),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: openLoginRecaptchaSecret(security.loginRecaptchaSecret), response: token, remoteip: clientIp(req) }),
  }).then((response) => response.json() as Promise<{ success?: boolean; hostname?: string }>).catch(() => null);

  const expectedHost = new URL(env.siteUrl).hostname.toLowerCase();
  const returnedHost = result?.hostname?.toLowerCase();
  if (!result?.success || (returnedHost && returnedHost !== expectedHost)) {
    throw new HttpError(400, 'We could not verify reCAPTCHA. Please try again.', 'captcha');
  }
}
