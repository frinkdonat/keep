import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authorized = isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized: Invalid API Key or Passcode' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, message: 'Connection successful and authenticated' });
}
