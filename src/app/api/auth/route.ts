import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthConfig,
  safeCompare,
  createSessionToken,
  verifySessionToken,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('keep_session');
  const authenticated = verifySessionToken(sessionCookie?.value);

  if (!authenticated) {
    return NextResponse.json({
      required: true,
      authenticated: false,
    });
  }

  const { isDefaultCredentials, apiKey } = getAuthConfig();
  const setupCompleted = db.isSetupCompleted();

  return NextResponse.json({
    required: true,
    authenticated: true,
    setupCompleted,
    isDefaultCredentials,
    apiKey: setupCompleted ? undefined : apiKey,
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

    const { username, password, isDefaultCredentials, apiKey } = getAuthConfig();

    const userMatch = safeCompare(inputUser, username);
    const passMatch = safeCompare(inputPass, password);

    if (userMatch && passMatch) {
      clearFailedAttempts(ip);
      const token = createSessionToken();
      const setupCompleted = db.isSetupCompleted();

      const response = NextResponse.json({
        ok: true,
        setupCompleted,
        isDefaultCredentials,
        apiKey: setupCompleted ? undefined : apiKey,
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
