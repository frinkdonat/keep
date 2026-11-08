import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, readJsonBounded } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const users = db.getAllUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await readJsonBounded<{ username?: string; password?: string }>(req, 4096);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || username.length < 2 || username.length > 32) {
      return NextResponse.json(
        { error: 'Username must be between 2 and 32 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Username may only contain letters, numbers, dots, hyphens, and underscores' },
        { status: 400 }
      );
    }

    if (!password || password.length < 4 || password.length > 256) {
      return NextResponse.json(
        { error: 'Password must be between 4 and 256 characters' },
        { status: 400 }
      );
    }

    const created = db.createUser(username, password);
    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
