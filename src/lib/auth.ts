import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import os from 'node:os';

export const DUMMY_DEFAULTS = {
  USERNAME: 'admin',
  PASSWORD: 'changeme',
  API_KEY: 'keep_secret_api_key',
};

export function getAuthConfig() {
  let rawUser =
    process.env.KEEP_USERNAME ||
    process.env.APP_USERNAME ||
    process.env.USERNAME ||
    DUMMY_DEFAULTS.USERNAME;

  // On Windows, OS sets process.env.USERNAME to the Windows login name before .env loads
  if (
    process.platform === 'win32' &&
    !process.env.KEEP_USERNAME &&
    !process.env.APP_USERNAME &&
    rawUser === os.userInfo().username
  ) {
    rawUser = DUMMY_DEFAULTS.USERNAME;
  }

  const username = rawUser.trim();

  const password = (
    process.env.KEEP_PASSWORD ||
    process.env.APP_PASSWORD ||
    process.env.PASSWORD ||
    DUMMY_DEFAULTS.PASSWORD
  ).trim();

  const apiKey = (
    process.env.API_KEY ||
    DUMMY_DEFAULTS.API_KEY
  ).trim();

  const isDefaultCredentials =
    username === DUMMY_DEFAULTS.USERNAME ||
    password === DUMMY_DEFAULTS.PASSWORD ||
    apiKey === DUMMY_DEFAULTS.API_KEY;

  return { username, password, apiKey, isDefaultCredentials };
}

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
 * Generates a deterministic HMAC-SHA256 session token bound to current credentials.
 * If USERNAME or PASSWORD is changed in Docker env vars, existing sessions immediately expire.
 */
export function createSessionToken(): string {
  const { username, password, apiKey } = getAuthConfig();
  return crypto
    .createHmac('sha256', `keep_hmac_key:${password}:${apiKey}`)
    .update(`session_v1:${username}`)
    .digest('hex');
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = createSessionToken();
  return safeCompare(token, expected);
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

export function isAuthorized(req: NextRequest): boolean {
  const { apiKey } = getAuthConfig();

  // 1. Check API Key header (Chrome Extension or API client)
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (apiKey && token && safeCompare(token, apiKey)) {
    return true;
  }

  // 2. Check signed web session cookie
  const sessionCookie = req.cookies.get('keep_session');
  if (sessionCookie && verifySessionToken(sessionCookie.value)) {
    return true;
  }

  return false;
}
