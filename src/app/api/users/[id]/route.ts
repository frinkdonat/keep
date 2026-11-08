import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, readJsonBounded } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (id === 'admin') {
    return NextResponse.json(
      { error: 'Primary admin credentials are managed via Docker environment variables' },
      { status: 400 }
    );
  }

  try {
    const body = await readJsonBounded<{ password?: string; regenerateApiKey?: boolean }>(
      req,
      4096
    );
    const password = body.password ? String(body.password) : undefined;
    const regenerateApiKey = Boolean(body.regenerateApiKey);

    if (password !== undefined && (password.length < 4 || password.length > 256)) {
      return NextResponse.json(
        { error: 'Password must be between 4 and 256 characters' },
        { status: 400 }
      );
    }

    const updated = await db.updateUser(id, { password, regenerateApiKey });
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (id === 'admin') {
    return NextResponse.json(
      { error: 'Cannot delete the primary admin account' },
      { status: 400 }
    );
  }

  const deleted = db.deleteUser(id);
  if (!deleted) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
