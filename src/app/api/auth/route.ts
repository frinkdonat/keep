import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const masterPasscode = process.env.MASTER_PASSCODE;
  if (!masterPasscode) {
    return NextResponse.json({ required: false, authenticated: true });
  }

  const sessionCookie = req.cookies.get('keep_session');
  const authenticated = sessionCookie?.value === masterPasscode;

  return NextResponse.json({
    required: true,
    authenticated
  });
}

export async function POST(req: NextRequest) {
  const masterPasscode = process.env.MASTER_PASSCODE;
  if (!masterPasscode) {
    return NextResponse.json({ ok: true, message: 'No passcode required' });
  }

  try {
    const { passcode } = await req.json();
    if (passcode === masterPasscode) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set('keep_session', masterPasscode, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
      return response;
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: false, error: 'Incorrect passcode' }, { status: 401 });
}
