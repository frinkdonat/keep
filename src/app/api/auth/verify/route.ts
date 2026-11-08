import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
}

export async function GET(req: NextRequest) {
  const authorized = isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized: Invalid API Key or Passcode' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, message: 'Connection successful and authenticated' });
}
