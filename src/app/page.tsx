import { cookies } from 'next/headers';
import { verifySessionCookie, getEnvAdminConfig } from '@/lib/auth';
import { db } from '@/lib/db';
import { KeepDashboard } from '@/components/KeepDashboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('keep_session');
  const user = verifySessionCookie(sessionCookie?.value);

  if (!user) {
    return (
      <KeepDashboard
        authenticated={false}
        user={null}
        setupCompleted={false}
        isDefaultCredentials={false}
        initialItems={[]}
        initialEtag={null}
      />
    );
  }

  const { isDefaultCredentials } = getEnvAdminConfig();
  const rawItems = db.getAll(user.id, 'all');
  const initialItems = rawItems.map((item) => ({
    id: String(item.id),
    user_id: String(item.user_id),
    url: String(item.url),
    title: String(item.title),
    description: item.description ? String(item.description) : null,
    image_url: item.image_url ? String(item.image_url) : null,
    favicon_url: item.favicon_url ? String(item.favicon_url) : null,
    domain: item.domain ? String(item.domain) : null,
    item_type: item.item_type || 'website',
    youtube_id: item.youtube_id ? String(item.youtube_id) : null,
    is_archived: item.is_archived === 1 ? 1 : 0,
    is_favorite: item.is_favorite === 1 ? 1 : 0,
    notes: item.notes ? String(item.notes) : null,
    created_at: Number(item.created_at),
    updated_at: Number(item.updated_at),
  }));
  const rev = db.getUserRevision(user.id);
  const initialEtag = `W/"u-${user.id}-r${rev}-all"`;

  return (
    <KeepDashboard
      authenticated={true}
      user={{
        id: user.id,
        username: user.username,
        role: user.role,
        apiKey: user.api_key,
      }}
      setupCompleted={user.setup_completed === 1}
      isDefaultCredentials={user.role === 'admin' ? isDefaultCredentials : false}
      apiKey={user.api_key}
      initialItems={initialItems}
      initialEtag={initialEtag}
    />
  );
}
