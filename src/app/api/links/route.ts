import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAuthorized } from '@/lib/auth';
import { fetchMetadata } from '@/lib/metadata';
import { FilterCategory } from '@/lib/types';

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get('filter') || 'inbox') as FilterCategory;

  const items = db.getAll(filter);
  const stats = db.getStats();

  return NextResponse.json({ items, stats });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let url = body.url?.trim();
    const initialTitle = body.title?.trim();
    const notes = body.notes?.trim();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // Check if item already exists
    const existing = db.getByUrl(url);
    if (existing) {
      // Re-activate if archived
      const updated = db.update(existing.id, {
        is_archived: 0,
        notes: notes || existing.notes || undefined,
      });
      return NextResponse.json({ ok: true, item: updated, reactivated: true });
    }

    // Fetch rich metadata (YouTube or OpenGraph website)
    const meta = await fetchMetadata(url, initialTitle);

    const item = db.create({
      url: meta.url,
      title: meta.title,
      description: meta.description || undefined,
      image_url: meta.image_url || undefined,
      favicon_url: meta.favicon_url || undefined,
      domain: meta.domain,
      item_type: meta.item_type,
      youtube_id: meta.youtube_id || undefined,
      notes: notes || undefined,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    console.error('Error saving link:', error);
    return NextResponse.json({ error: 'Failed to process link' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('scope') === 'archive') {
    const deletedCount = db.clearArchive();
    return NextResponse.json({ ok: true, count: deletedCount });
  }

  return NextResponse.json({ error: 'Missing or invalid scope' }, { status: 400 });
}
