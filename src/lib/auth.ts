import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { db, getEnvAdminConfig, computeSessionToken, CachedUser } from './db';
import { UserRecord } from './types';

export { getEnvAdminConfig };

/**
 * Returns the pre-computed HMAC-SHA256 session cookie token for a user,
 * or computes it if passed a raw UserRecord.
 */
export function createSessionToken(user: UserRecord | CachedUser): string {
  if ('sessionToken' in user && typeof user.sessionToken === 'string') {
    return user.sessionToken;
  }
  return computeSessionToken(user).token;
}

/**
 * O(1) zero-allocation session cookie verification using pre-computed HMAC buffers.
 */
export function verifySessionCookie(cookieValue: string | undefined): CachedUser | null {
  if (!cookieValue || cookieValue.length > 256) return null;
  const dotIdx = cookieValue.indexOf('.');
  if (dotIdx <= 0) return null;

  const userId = cookieValue.slice(0, dotIdx);
  const sigHex = cookieValue.slice(dotIdx + 1);

  if (sigHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(sigHex)) return null;

  const user = db.getUserById(userId);
  if (!user) return null;

  const sigBuf = Buffer.from(sigHex, 'hex');
  if (sigBuf.length !== user.sessionSigBuf.length) return null;

  if (crypto.timingSafeEqual(sigBuf, user.sessionSigBuf)) {
    return user;
  }
  return null;
}

/**
 * CSRF protection for cookie-authenticated state-changing requests (POST, PATCH, DELETE).
 */
export function verifyCsrfOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    const origin = req.headers.get('origin') || '';
    if (!origin.startsWith('chrome-extension://') && !origin.startsWith('moz-extension://')) {
      return false;
    }
  }

  const origin = req.headers.get('origin');
  if (origin) {
    if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
      return true;
    }
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
      const host = (forwardedHost || req.headers.get('host') || '').toLowerCase();
      if (host && originHost !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Resolves the authenticated UserRecord from either API Key header (Chrome Extension)
 * or signed HttpOnly session cookie (Web UI).
 */
export function getAuthenticatedUser(req: NextRequest): CachedUser | null {
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (token) {
    if (token.length > 256) return null;
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) return null;

    const user = db.getUserByApiKey(token);
    if (user) {
      const tokenHash = crypto.createHash('sha256').update(token).digest();
      if (
        tokenHash.length === user.apiKeyHashBuf.length &&
        crypto.timingSafeEqual(tokenHash, user.apiKeyHashBuf)
      ) {
        return user;
      }
    }
    recordFailedAttempt(ip);
    return null;
  }

  const sessionCookie = req.cookies.get('keep_session');
  const user = verifySessionCookie(sessionCookie?.value);
  if (!user) return null;

  if (!verifyCsrfOrigin(req)) {
    return null;
  }

  return user;
}

export function isAuthorized(req: NextRequest): boolean {
  return getAuthenticatedUser(req) !== null;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TRACKED_IPS = 2000;
const loginAttempts = new Map<string, RateLimitEntry>();

// Global anti-spoofing rate limit (caps brute-force velocity even if X-Forwarded-For is spoofed)
const GLOBAL_MAX_FAILED_PER_MIN = 25;
const GLOBAL_WINDOW_MS = 60 * 1000;
let globalFailedCount = 0;
let globalResetAt = 0;

/**
 * Extracts client IP securely: prioritizes Cloudflare's unforgeable CF-Connecting-IP,
 * then X-Real-IP, then the rightmost hop of X-Forwarded-For.
 */
export function getClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim().slice(0, 64);

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim().slice(0, 64);

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',');
    return hops[hops.length - 1].trim().slice(0, 64);
  }
  return 'local';
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  if (now < globalResetAt && globalFailedCount >= GLOBAL_MAX_FAILED_PER_MIN) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((globalResetAt - now) / 1000)),
    };
  }

  const entry = loginAttempts.get(ip);
  if (!entry) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (now > entry.resetAt) {
    loginAttempts.delete(ip);
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

  if (now > globalResetAt) {
    globalFailedCount = 1;
    globalResetAt = now + GLOBAL_WINDOW_MS;
  } else {
    globalFailedCount++;
  }

  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    if (loginAttempts.size >= MAX_TRACKED_IPS) {
      const oldestKey = loginAttempts.keys().next().value;
      if (oldestKey) loginAttempts.delete(oldestKey);
    }
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    loginAttempts.delete(ip);
    loginAttempts.set(ip, { count: entry.count + 1, resetAt: entry.resetAt });
  }
}

export function clearFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Safely parses JSON request bodies with a strict byte-size cap (default 8KB)
 * to prevent memory exhaustion / DoS attacks.
 */
export async function readJsonBounded<T = Record<string, unknown>>(
  req: NextRequest,
  maxBytes = 8192
): Promise<T> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error('Payload too large');
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new Error('Payload too large');
  }
  return JSON.parse(text) as T;
}
