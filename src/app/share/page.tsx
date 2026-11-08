import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySessionCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { extractFastMetadata, fetchMetadata, isValidHttpUrl } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

interface SharePageProps {
  searchParams: Promise<{
    title?: string;
    text?: string;
    url?: string;
  }>;
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const rawCandidate = params.url || params.text || '';
  const initialTitle = params.title || undefined;

  let targetUrl = extractUrl(rawCandidate);
  if (!targetUrl && rawCandidate.trim().length > 0 && !rawCandidate.includes(' ')) {
    targetUrl = rawCandidate.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
  }

  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    redirect('/');
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('keep_session');
  const user = verifySessionCookie(sessionCookie?.value);

  if (!user) {
    redirect(`/?pending_save=${encodeURIComponent(targetUrl)}`);
  }

  try {
    const normalizedUrl = new URL(targetUrl).href;
    const existing = db.getByUrl(user.id, normalizedUrl);

    if (existing) {
      db.update(user.id, existing.id, { is_archived: 0 });
      redirect('/?saved=1');
    }

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
  } catch {
    redirect('/');
  }

  redirect('/?saved=1');
}
