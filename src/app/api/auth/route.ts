import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvAdminConfig,
  createSessionToken,
  getAuthenticatedUser,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/auth';
import { db, verifyPassword, hashPassword } from '@/lib/db';

const DUMMY_HASH = hashPassword('dummy_timing_protection_password');

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);

  if (!user) {
    return NextResponse.json({
      required: true,
      authenticated: false,
    });
  }

  const { isDefaultCredentials } = getEnvAdminConfig();

  return NextResponse.json({
    required: true,
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      apiKey: user.api_key,
    },
    setupCompleted: user.setup_completed === 1,
    isDefaultCredentials: user.role === 'admin' ? isDefaultCredentials : false,
    apiKey: user.api_key,
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    const mins = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        ok: false,
        error: `Too many failed attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'}.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const inputUser = String(body.username || '').trim();
    const inputPass = String(body.password || '');

    const user = inputUser ? db.getUserByUsername(inputUser) : null;

    // Constant-time password verification even if username does not exist (prevents user enumeration)
    const passValid = user
      ? verifyPassword(inputPass, user.password_hash)
      : verifyPassword(inputPass, DUMMY_HASH) && false;

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
        setupCompleted: user.setup_completed === 1,
        isDefaultCredentials: user.role === 'admin' ? isDefaultCredentials : false,
        apiKey: user.api_key,
      });

      response.cookies.set('keep_session', token, {
        httpOnly: true,
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
