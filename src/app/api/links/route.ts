import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { extractFastMetadata, fetchMetadata } from '@/lib/metadata';
import { FilterCategory } from '@/lib/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
}

export async function GET(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get('filter') || 'all') as FilterCategory;

  const items = db.getAll(user.id, filter);
  const stats = db.getStats(user.id);

  return NextResponse.json(
    { items, stats },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user) {
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

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // Check if item already exists in this user's workspace
    const existing = db.getByUrl(user.id, url);
    if (existing) {
      const updated = db.update(user.id, existing.id, {
        is_archived: 0,
        notes: notes || existing.notes || undefined,
      });
      return NextResponse.json({ ok: true, item: updated, reactivated: true });
    }

    // 1. Synchronous zero-latency metadata extraction (< 0.05ms)
    const fastMeta = extractFastMetadata(url, initialTitle);

    // 2. Immediate SQLite insert (< 0.5ms)
    const item = db.create({
      user_id: user.id,
      url: fastMeta.url,
      title: fastMeta.title,
      description: fastMeta.description || undefined,
      image_url: fastMeta.image_url || undefined,
      favicon_url: fastMeta.favicon_url || undefined,
      domain: fastMeta.domain,
      item_type: fastMeta.item_type,
      youtube_id: fastMeta.youtube_id || undefined,
      notes: notes || undefined,
    });

    // 3. Fire-and-forget asynchronous OpenGraph/oEmbed enrichment in background
    fetchMetadata(url, initialTitle)
      .then((enriched) => {
        db.enrichMetadata(user.id, item.id, {
          title: enriched.title,
          description: enriched.description,
          image_url: enriched.image_url,
          favicon_url: enriched.favicon_url,
        });
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    console.error('Error saving link:', error);
    return NextResponse.json({ error: 'Failed to process link' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('scope') === 'archive') {
    const deletedCount = db.clearArchive(user.id);
    return NextResponse.json({ ok: true, count: deletedCount });
  }

  return NextResponse.json({ error: 'Missing or invalid scope' }, { status: 400 });
}
