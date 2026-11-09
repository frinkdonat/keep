import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvAdminConfig,
  createSessionToken,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  readJsonBounded,
} from '@/lib/auth';
import { db, verifyPasswordAsync, hashPasswordSync } from '@/lib/db';

const DUMMY_HASH = hashPasswordSync('dummy_timing_protection_password');

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    const mins = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
    return NextResponse.json(
      {
        ok: false,
        error: `Too many failed attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'}.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await readJsonBounded<{ username?: string; password?: string }>(req, 4096);
    const inputUser = String(body.username || '').trim().slice(0, 64);
    const inputPass = String(body.password || '').slice(0, 256);

    const user = inputUser ? db.getUserByUsername(inputUser) : null;

    // Non-blocking constant-time password verification on worker pool
    const passValid = user
      ? await verifyPasswordAsync(inputPass, user.password_hash)
      : (await verifyPasswordAsync(inputPass, DUMMY_HASH)) && false;

    if (user && passValid) {
      clearFailedAttempts(ip);
      const token = createSessionToken(user);
      const { isDefaultCredentials } = getEnvAdminConfig();

      const response = NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          apiKey: user.api_key,
        },
        isDefaultCredentials: user.role === 'admin' ? isDefaultCredentials : false,
        apiKey: user.api_key,
      });

      const isHttps =
        req.nextUrl.protocol === 'https:' ||
        req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';

      response.cookies.set('keep_session', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });

      return response;
    }

    recordFailedAttempt(ip);
  } catch {
    // ignore malformed json
  }

  return NextResponse.json(
    { ok: false, error: 'Invalid username or password' },
    { status: 401 }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('keep_session');
  return response;
}
