import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { extractFastMetadata, fetchMetadata, isValidHttpUrl } from '@/lib/metadata';

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

const SAVED_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#08080a">
<title>Keep</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#08080a;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;height:100dvh;display:flex;align-items:center;justify-content:center;user-select:none}
  .pill{display:flex;align-items:center;gap:10px;padding:14px 22px;border-radius:16px;background:#101015;border:1px solid rgba(16,185,129,0.3);box-shadow:0 20px 40px rgba(0,0,0,0.8)}
  .check{width:22px;height:22px;border-radius:50%;background:rgba(16,185,129,0.15);color:#34d399;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
  .text{font-size:14px;font-weight:600;color:#e4e4e7;letter-spacing:0.01em}
</style>
</head>
<body>
  <div class="pill">
    <div class="check">✓</div>
    <div class="text">Saved to Keep</div>
  </div>
  <script>
    setTimeout(function() {
      try { window.close(); } catch (e) {}
      setTimeout(function() {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.replace('/');
        }
      }, 150);
    }, 900);
  </script>
</body>
</html>`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCandidate = searchParams.get('url') || searchParams.get('text') || '';
  const initialTitle = searchParams.get('title')?.trim().slice(0, 500) || undefined;

  let targetUrl = extractUrl(rawCandidate);
  if (!targetUrl && rawCandidate.trim().length > 0 && !rawCandidate.includes(' ')) {
    targetUrl = rawCandidate.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
  }

  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const sessionCookie = req.cookies.get('keep_session');
  const user = verifySessionCookie(sessionCookie?.value);

  if (!user) {
    return NextResponse.redirect(
      new URL(`/?pending_save=${encodeURIComponent(targetUrl)}`, req.url)
    );
  }

  try {
    const normalizedUrl = new URL(targetUrl).href;
    const existing = db.getByUrl(user.id, normalizedUrl);

    if (existing) {
      db.update(user.id, existing.id, { is_archived: 0 });
    } else {
      const fastMeta = extractFastMetadata(normalizedUrl, initialTitle);
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
      });

      setImmediate(() => {
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
      });
    }
  } catch {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return new NextResponse(SAVED_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
