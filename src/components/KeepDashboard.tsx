'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Archive,
  Trash2,
  LogOut,
  Users,
} from 'lucide-react';
import { KeepItem, FilterCategory, ItemStats } from '@/lib/types';
import { FilterTabs } from '@/components/FilterTabs';
import { ItemCard } from '@/components/ItemCard';
import {
  PasscodeLock,
  LoginSuccessPayload,
  AuthenticatedUserInfo,
} from '@/components/PasscodeLock';
import { OnboardingModal } from '@/components/OnboardingModal';
import { UserManagementModal } from '@/components/UserManagementModal';

export interface InitialBootstrapProps {
  authenticated: boolean;
  user: AuthenticatedUserInfo | null;
  setupCompleted: boolean;
  isDefaultCredentials: boolean;
  apiKey?: string;
  initialItems: KeepItem[];
  initialEtag: string | null;
}

export function KeepDashboard({
  authenticated,
  user,
  setupCompleted,
  isDefaultCredentials: initialIsDefault,
  apiKey: initialApiKey,
  initialItems,
  initialEtag,
}: InitialBootstrapProps) {
  const [allItems, setAllItems] = useState<KeepItem[]>(initialItems);
  const [filter, setFilter] = useState<FilterCategory>('inbox');
  const [clearingArchive, setClearingArchive] = useState(false);
  const [confirmClearArchive, setConfirmClearArchive] = useState(false);

  const etagRef = useRef<string | null>(initialEtag);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

  const [needsAuth, setNeedsAuth] = useState(!authenticated);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserInfo | null>(user);
  const [showOnboarding, setShowOnboarding] = useState(authenticated && !setupCompleted);
  const [isDefaultCredentials, setIsDefaultCredentials] = useState(initialIsDefault);
  const [setupApiKey, setSetupApiKey] = useState<string | undefined>(initialApiKey);

  useEffect(() => {
    if (!confirmClearArchive) return;
    const timer = setTimeout(() => setConfirmClearArchive(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClearArchive]);

  // Conditional ETag sync (transfers 0 bytes when unchanged)
  const loadItems = useCallback(async (force = false) => {
    try {
      const headers: Record<string, string> = {};
      if (!force && etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const res = await fetch('/api/links?filter=all', { headers });
      if (res.status === 304) {
        return;
      }
      if (res.status === 401) {
        setNeedsAuth(true);
        setCurrentUser(null);
        etagRef.current = null;
        return;
      }
      if (res.ok) {
        const newEtag = res.headers.get('etag');
        if (newEtag) etagRef.current = newEtag;
        const data = await res.json();
        setAllItems(data.items || []);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  // Sync automatically when switching back to the Keep tab
  useEffect(() => {
    if (needsAuth) return;
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadItems(false);
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [needsAuth, loadItems]);

  const stats = useMemo<ItemStats>(() => {
    let inboxCount = 0;
    let archiveCount = 0;

    for (let i = 0; i < allItems.length; i++) {
      if (allItems[i].is_archived === 1) {
        archiveCount++;
      } else {
        inboxCount++;
      }
    }

    return { inboxCount, archiveCount };
  }, [allItems]);

  const items = useMemo<KeepItem[]>(() => {
    if (filter === 'archive') {
      return allItems.filter((i) => i.is_archived === 1);
    }
    return allItems.filter((i) => i.is_archived === 0);
  }, [allItems, filter]);

  const handleLoginSuccess = useCallback(
    (payload: LoginSuccessPayload) => {
      etagRef.current = null;
      setNeedsAuth(false);
      setCurrentUser(payload.user);
      setShowOnboarding(!payload.setupCompleted);
      setIsDefaultCredentials(payload.isDefaultCredentials);
      setSetupApiKey(payload.apiKey);
      loadItems(true);
    },
    [loadItems]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    etagRef.current = null;
    setNeedsAuth(true);
    setCurrentUser(null);
    setAllItems([]);
  }, []);

  const handleToggleArchive = useCallback(
    async (item: KeepItem) => {
      const nextArchived = item.is_archived === 1 ? 0 : 1;
      setAllItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_archived: nextArchived } : i
        )
      );

      try {
        await fetch(`/api/links/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_archived: nextArchived }),
        });
      } catch {
        loadItems(true);
      }
    },
    [loadItems]
  );

  const handleDelete = useCallback(
    async (item: KeepItem) => {
      setAllItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        await fetch(`/api/links/${item.id}`, { method: 'DELETE' });
      } catch {
        loadItems(true);
      }
    },
    [loadItems]
  );

  const handleClearArchive = useCallback(async () => {
    if (!confirmClearArchive) {
      setConfirmClearArchive(true);
      return;
    }
    setConfirmClearArchive(false);
    setClearingArchive(true);
    setAllItems((prev) => prev.filter((i) => i.is_archived === 0));

    try {
      await fetch('/api/links?scope=archive', { method: 'DELETE' });
    } catch {
      loadItems(true);
    } finally {
      setClearingArchive(false);
    }
  }, [confirmClearArchive, loadItems]);

  if (needsAuth) {
    return <PasscodeLock onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col selection:bg-indigo-500/20 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#08080a]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-2.5">
          <div className="flex items-center justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
            {/* Left: Logo & Clickable Username Pill */}
            <div className="flex items-center gap-2 select-none">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-white" />
              </div>
              <span className="font-semibold tracking-wider text-xs sm:text-sm text-zinc-100">
                KEEP
              </span>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] sm:text-[11px] font-mono text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors cursor-pointer"
                  title="View API Key & Extension Setup Guide"
                >
                  {currentUser.username}
                </button>
              )}
            </div>

            {/* Desktop Center: 2-Tab Toggle (Watch Later | Archive) */}
            <div className="hidden sm:flex justify-center">
              <FilterTabs
                activeFilter={filter}
                onFilterChange={setFilter}
                stats={stats}
              />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
              {filter === 'archive' && items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearArchive}
                  disabled={clearingArchive}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none ${
                    confirmClearArchive
                      ? 'border-rose-500/50 bg-rose-500/25 text-rose-200'
                      : 'border-rose-500/25 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                  }`}
                  title={
                    confirmClearArchive
                      ? 'Click again to permanently delete all archived items'
                      : 'Permanently delete all items in Archive'
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{confirmClearArchive ? 'Sure?' : 'Delete All'}</span>
                </button>
              )}

              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsUsersModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 sm:px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-zinc-100 transition-colors cursor-pointer select-none"
                  title="Manage Users & Workspaces"
                >
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Users</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile 2-Column Tab Bar (50% Watch Later / 50% Archive) */}
          <div className="flex sm:hidden mt-2 w-full">
            <FilterTabs
              activeFilter={filter}
              onFilterChange={setFilter}
              stats={stats}
            />
          </div>
        </div>
      </header>

      {/* Main Card Grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggleArchive={handleToggleArchive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-36 text-center select-none">
            {filter === 'inbox' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101015] text-zinc-400 mb-3.5 border border-white/[0.07]">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400/80" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">All caught up</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  Your Watch Later queue is clear.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101015] text-zinc-400 mb-3.5 border border-white/[0.07]">
                  <Archive className="h-6 w-6 text-zinc-500" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400">Archive empty</h3>
              </>
            )}
          </div>
        )}
      </main>

      {/* Static Watermark */}
      <div className="fixed bottom-4 right-4 z-10 pointer-events-none select-none opacity-25">
        <img
          src="/watermark.png"
          alt=""
          className="h-7 w-7 rounded-lg"
          draggable={false}
          decoding="async"
        />
      </div>

      {/* Onboarding & API Key Guide Modal */}
      {showOnboarding && (
        <OnboardingModal
          isDefaultCredentials={isDefaultCredentials}
          apiKey={setupApiKey || currentUser?.apiKey}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Admin User Management Modal */}
      {currentUser?.role === 'admin' && isUsersModalOpen && (
        <UserManagementModal onClose={() => setIsUsersModalOpen(false)} />
      )}
    </div>
  );
}
