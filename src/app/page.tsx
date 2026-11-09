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
        isDefaultCredentials={false}
        initialItems={[]}
        initialEtag={null}
      />
    );
  }

  const { isDefaultCredentials } = getEnvAdminConfig();
  const initialItems = db.getAll(user.id, 'all');
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
      isDefaultCredentials={user.role === 'admin' ? isDefaultCredentials : false}
      apiKey={user.api_key}
      initialItems={initialItems}
      initialEtag={initialEtag}
    />
  );
}
