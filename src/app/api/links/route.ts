import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, readJsonBounded } from '@/lib/auth';
import { fetchMetadata, isValidHttpUrl } from '@/lib/metadata';
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
  const rawFilter = searchParams.get('filter');
  const filter: FilterCategory =
    rawFilter === 'archive' ? 'archive' : rawFilter === 'inbox' ? 'inbox' : 'all';

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
    }>(req, 8192);

    let url = typeof body.url === 'string' ? body.url.trim() : '';
    const initialTitle =
      typeof body.title === 'string' ? body.title.trim().slice(0, 500) : undefined;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!/^https?:\/\//i.test(url)) {
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

    const normalizedUrl = new URL(url).href;

    const existing = db.getByUrl(user.id, normalizedUrl);
    if (existing) {
      const updated = db.update(user.id, existing.id, { is_archived: 0 });
      return NextResponse.json({ ok: true, item: updated, reactivated: true });
    }

    // One-shot fast metadata extraction (0ms for YouTube with title, <=1.2s cap for websites)
    const meta = await fetchMetadata(normalizedUrl, initialTitle);

    const item = db.create({
      user_id: user.id,
      url: meta.url,
      title: meta.title,
      image_url: meta.image_url,
      favicon_url: meta.favicon_url,
      domain: meta.domain,
      item_type: meta.item_type,
      youtube_id: meta.youtube_id,
    });

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
