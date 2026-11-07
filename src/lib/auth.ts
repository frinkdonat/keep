import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Prevent length timing leaks while returning false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAuthorized(req: NextRequest): boolean {
  const configuredApiKey = process.env.API_KEY;
  const masterPasscode = process.env.MASTER_PASSCODE;

  // 1. Check API Key header (Extension or CLI)
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (xApiKey) {
    token = xApiKey.trim();
  }

  if (configuredApiKey && token && safeCompare(token, configuredApiKey)) {
    return true;
  }

  // 2. If no master passcode is configured, local web UI is open
  if (!masterPasscode) {
    return true;
  }

  // 3. Check web session cookie
  const sessionCookie = req.cookies.get('keep_session');
  if (sessionCookie && safeCompare(sessionCookie.value, masterPasscode)) {
    return true;
  }

  return false;
}
