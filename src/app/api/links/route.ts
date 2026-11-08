import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, readJsonBounded } from '@/lib/auth';
import { extractFastMetadata, fetchMetadata, isValidHttpUrl } from '@/lib/metadata';
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

  // O(1) in-memory revision ETag check — returns 304 in <0.01ms with 0 SQLite queries if unchanged!
  const rev = db.getUserRevision(user.id);
  const etag = `W/"u-${user.id}-r${rev}-${filter}"`;
  const ifNoneMatch = req.headers.get('if-none-match');

  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, no-cache, must-revalidate',
      },
    });
  }

  const items = db.getAll(user.id, filter);

  return NextResponse.json(
    { items },
    {
      headers: {
        ETag: etag,
        'Cache-Control': 'private, no-cache, must-revalidate',
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
    const body = await readJsonBounded<{
      url?: string;
      title?: string;
      notes?: string;
    }>(req, 8192);

    let url = typeof body.url === 'string' ? body.url.trim() : '';
    const initialTitle =
      typeof body.title === 'string' ? body.title.trim().slice(0, 500) : undefined;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : undefined;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!/^https?:\/\//i.test(url)) {
      // Reject dangerous schemes like javascript:, data:, file:, vbscript:
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
        return NextResponse.json(
          { error: 'Only http:// and https:// URLs are allowed' },
          { status: 400 }
        );
      }
      url = 'https://' + url;
    }

    if (!isValidHttpUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL or exceeds maximum length (2048 chars)' },
        { status: 400 }
      );
    }

    // Normalize URL via WHATWG URL parser
    const normalizedUrl = new URL(url).href;

    // Check if item already exists in this user's workspace
    const existing = db.getByUrl(user.id, normalizedUrl);
    if (existing) {
      const updated = db.update(user.id, existing.id, {
        is_archived: 0,
        notes: notes || existing.notes || undefined,
      });
      return NextResponse.json({ ok: true, item: updated, reactivated: true });
    }

    // 1. Synchronous zero-latency metadata extraction (< 0.05ms)
    const fastMeta = extractFastMetadata(normalizedUrl, initialTitle);

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
    fetchMetadata(normalizedUrl, initialTitle)
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
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'Payload too large') {
      return NextResponse.json({ error: 'Request payload too large (max 8KB)' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Failed to process link' }, { status: 400 });
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
