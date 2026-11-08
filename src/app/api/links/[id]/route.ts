import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, readJsonBounded } from '@/lib/auth';
import { UpdateItemInput } from '@/lib/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await readJsonBounded<UpdateItemInput>(req, 8192);
    const sanitized: UpdateItemInput = {};

    if (typeof body.title === 'string') {
      sanitized.title = body.title.trim().slice(0, 500);
    }
    if (typeof body.description === 'string') {
      sanitized.description = body.description.trim().slice(0, 1000);
    }
    if (body.is_archived !== undefined) {
      sanitized.is_archived = body.is_archived ? 1 : 0;
    }
    if (typeof body.notes === 'string') {
      sanitized.notes = body.notes.trim().slice(0, 1000);
    }

    const updated = db.update(user.id, id, sanitized);
    if (!updated) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = db.delete(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
