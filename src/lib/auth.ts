import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { db, getEnvAdminConfig } from './db';
import { UserRecord } from './types';

export { getEnvAdminConfig };

/**
 * Constant-time string comparison immune to length and timing side-channel attacks
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

/**
 * Generates an HMAC-SHA256 signed session cookie token bound to a specific user's credentials.
 * Format: `${user.id}.${hmac}`
 * Changing a user's password or deleting the user immediately invalidates their session.
 */
export function createSessionToken(user: UserRecord): string {
  const sig = crypto
    .createHmac('sha256', `keep_user_hmac:${user.password_hash}:${user.api_key}`)
    .update(`session_v2:${user.id}:${user.username}`)
    .digest('hex');
  return `${user.id}.${sig}`;
}

export function verifySessionCookie(cookieValue: string | undefined): UserRecord | null {
  if (!cookieValue) return null;
  const dotIdx = cookieValue.indexOf('.');
  if (dotIdx <= 0) return null;

  const userId = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);

  const user = db.getUserById(userId);
  if (!user) return null;

  const expected = createSessionToken(user);
  const expectedSig = expected.slice(dotIdx + 1);

  if (safeCompare(sig, expectedSig)) {
    return user;
  }
  return null;
}

/**
 * Resolves the authenticated UserRecord from either API Key header (Chrome Extension)
 * or signed HttpOnly session cookie (Web UI).
 */
export function getAuthenticatedUser(req: NextRequest): UserRecord | null {
  // 1. Check API Key header (Chrome Extension or API client)
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (token) {
    const user = db.getUserByApiKey(token);
    if (user && safeCompare(token, user.api_key)) {
      return user;
    }
  }

  // 2. Check signed web session cookie
  const sessionCookie = req.cookies.get('keep_session');
  return verifySessionCookie(sessionCookie?.value);
}

export function isAuthorized(req: NextRequest): boolean {
  return getAuthenticatedUser(req) !== null;
}

// Brute-force protection (in-memory rate limiter per IP)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const loginAttempts = new Map<string, RateLimitEntry>();

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'local';
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}
