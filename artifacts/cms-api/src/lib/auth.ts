import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { env } from '../env.ts';
import type { Role } from '../generated/prisma/client.ts';
import { HttpError, clientIp, forbidden } from './http.ts';
import { can, capabilitiesFor, type Capability } from './permissions.ts';

export const SESSION_COOKIE = 'nextract_session';
const BCRYPT_ROUNDS = 12;
const scryptAsync = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, hash) => error ? reject(error) : resolve(hash));
});
const SCRYPT_PREFIX = 'nextract-scrypt-v1:';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string;
  twoFactorEnabled: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
      authenticatedAt?: Date;
    }
  }
}

export const passwordSchema = z
  .string()
  .min(15, 'Use at least 15 characters; a long passphrase works well.')
  .max(200, 'Use at most 200 characters.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(200);

export async function hashPassword(password: string) {
  // Raw bcrypt silently truncates after 72 UTF-8 bytes. Use a versioned,
  // memory-hard verifier for new long passphrases; existing hashes still work.
  if (Buffer.byteLength(password, 'utf8') <= 72) return bcrypt.hash(password, BCRYPT_ROUNDS);
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt);
  return `${SCRYPT_PREFIX}${salt}:${hash.toString('hex')}`;
}

// A real hash of a throwaway password, compared against when an email does not
// exist so a failed login takes the same time either way and cannot be used to
// discover which addresses have accounts.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (hash?.startsWith(SCRYPT_PREFIX)) {
    const [salt, encoded] = hash.slice(SCRYPT_PREFIX.length).split(':');
    if (!/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(encoded ?? '')) return false;
    const candidate = await scryptAsync(password, salt);
    return timingSafeEqual(candidate, Buffer.from(encoded, 'hex'));
  }
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export async function startSession(res: Response, req: Request, userId: string) {
  const token = randomToken();
  const ttl = env.SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.$transaction(async (tx) => {
    if (req.sessionId) await tx.session.deleteMany({ where: { id: req.sessionId } });
    await tx.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + ttl),
      ip: clientIp(req).slice(0, 64),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    },
    });
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttl));
}

export async function endSession(req: Request, res: Response) {
  if (req.sessionId) {
    await db.session.deleteMany({ where: { id: req.sessionId } });
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function toAuthUser(user: { id: string; email: string; name: string; role: Role; avatarUrl: string; totpEnabledAt?: Date | null; emailOtpEnabled?: boolean }): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, twoFactorEnabled: Boolean(user.totpEnabledAt) || Boolean(user.emailOtpEnabled) };
}

// A 6-digit email one-time code: returned once (to email it), stored only as a
// hash, valid for ten minutes.
export const EMAIL_OTP_TTL_MINUTES = 10;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

export function generateEmailOtp() {
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
  return { code, hash: sha256(code), expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MINUTES * 60 * 1000) };
}

// Hide most of an address for display: "jane@example.com" -> "j••e@example.com".
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const shown = local.length <= 2 ? local[0] ?? '' : `${local[0]}${'•'.repeat(Math.min(3, local.length - 2))}${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}

// Single-use hand-off. Reuse the expiring token table with a separate digest
// namespace so a challenge can NEVER be used as a password-reset credential.
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export const mfaDigest = (token: string) => sha256(`mfa-v1:${token}`);

export async function signMfaChallenge(userId: string) {
  const token = randomToken();
  await db.passwordResetToken.create({ data: { tokenHash: mfaDigest(token), userId, expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS) } });
  return token;
}

export async function verifyMfaChallenge(token: string): Promise<string | null> {
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: mfaDigest(token) } });
  return row && !row.usedAt && row.expiresAt > new Date() ? row.userId : null;
}

export function describeUser(user: AuthUser) {
  return { ...user, capabilities: capabilitiesFor(user.role) };
}

// Resolves the session cookie to a user on every request. Never rejects:
// routes that need a user say so with requireAuth.
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return next();

  const id = sha256(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return next();
  if (session.expiresAt <= new Date() || Date.now() - session.lastSeenAt.getTime() >= env.SESSION_IDLE_MINUTES * 60_000 || !session.user.active) {
    await db.session.deleteMany({ where: { id } });
    return next();
  }

  req.user = toAuthUser(session.user);
  req.sessionId = id;
  req.authenticatedAt = session.createdAt;

  // Record activity at most every five minutes rather than on every request.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    db.session.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.', 'unauthenticated'));
  next();
}

export function requireRecentAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.', 'unauthenticated'));
  if (!req.authenticatedAt || Date.now() - req.authenticatedAt.getTime() > 15 * 60_000) {
    return next(new HttpError(403, 'Confirm your sign-in to continue with this sensitive action.', 'reauth_required'));
  }
  next();
}

export function requireCap(...needed: Capability[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue.', 'unauthenticated'));
    // Any one of the listed capabilities is enough.
    if (!needed.some((capability) => can(req.user!.role, capability))) return next(forbidden());
    next();
  };
}

export function userCan(req: Request, capability: Capability) {
  return Boolean(req.user && can(req.user.role, capability));
}

export async function adminMfaRequired() {
  const { getSetting } = await import('./settings.ts');
  return env.REQUIRE_ADMIN_MFA || (await getSetting('security')).requireTwoFactor;
}
