'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Tv,
  Archive,
  FileText,
  Trash2,
  LogOut,
  Users,
} from 'lucide-react';
import { KeepItem, FilterCategory, ItemStats } from '@/lib/types';
import { FilterTabs } from '@/components/FilterTabs';
import { ItemCard } from '@/components/ItemCard';
import { VideoModal } from '@/components/VideoModal';
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

  // Track latest ETag for 0-byte 304 Not Modified conditional syncs
  const etagRef = useRef<string | null>(initialEtag);

  // Modals
  const [selectedVideo, setSelectedVideo] = useState<KeepItem | null>(null);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-hydrated Auth & First-Time Setup State (0 client roundtrips on initial load)
  const [needsAuth, setNeedsAuth] = useState(!authenticated);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserInfo | null>(user);
  const [showOnboarding, setShowOnboarding] = useState(authenticated && !setupCompleted);
  const [isDefaultCredentials, setIsDefaultCredentials] = useState(initialIsDefault);
  const [setupApiKey, setSetupApiKey] = useState<string | undefined>(initialApiKey);

  // Conditional ETag sync (transfers 0 bytes when unchanged)
  const loadItems = useCallback(async (force = false) => {
    try {
      const headers: Record<string, string> = {};
      if (!force && etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const res = await fetch('/api/links?filter=all', { headers });
      if (res.status === 304) {
        return; // Unchanged — 0 SQLite queries & 0 bytes transferred!
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
    } catch (err) {
      console.error('Failed to sync links:', err);
    }
  }, []);

  // Auto-sync when switching back to the Keep browser tab (picks up Chrome Extension saves)
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

  // Handle Mobile PWA Share Target feedback & pending saves
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
      setToastMessage('Saved to Keep');
      loadItems(true);
      window.history.replaceState({}, '', window.location.pathname);
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }

    const pendingUrl = params.get('pending_save');
    if (pendingUrl && !needsAuth) {
      window.history.replaceState({}, '', window.location.pathname);
      fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pendingUrl }),
      })
        .then(() => {
          setToastMessage('Saved to Keep');
          loadItems(true);
          setTimeout(() => setToastMessage(null), 3500);
        })
        .catch(() => {});
    }
  }, [needsAuth, loadItems]);

  // Instant 0ms in-memory stats calculation
  const stats = useMemo<ItemStats>(() => {
    let inboxCount = 0;
    let videosCount = 0;
    let articlesCount = 0;
    let archiveCount = 0;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      if (item.is_archived === 1) {
        archiveCount++;
      } else {
        inboxCount++;
        if (item.item_type === 'youtube') {
          videosCount++;
        } else {
          articlesCount++;
        }
      }
    }

    return {
      inboxCount,
      videosCount,
      articlesCount,
      favoritesCount: 0,
      archiveCount,
      totalCount: allItems.length,
    };
  }, [allItems]);

  // Instant 0ms in-memory tab filtering
  const items = useMemo<KeepItem[]>(() => {
    switch (filter) {
      case 'videos':
        return allItems.filter(
          (i) => i.is_archived === 0 && i.item_type === 'youtube'
        );
      case 'articles':
        return allItems.filter(
          (i) => i.is_archived === 0 && i.item_type === 'website'
        );
      case 'archive':
        return allItems.filter((i) => i.is_archived === 1);
      case 'all':
        return allItems;
      case 'inbox':
      default:
        return allItems.filter((i) => i.is_archived === 0);
    }
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

  // Toggle Archive (0ms optimistic update, single background PATCH)
  const handleToggleArchive = useCallback(
    async (item: KeepItem) => {
      const nextArchived = item.is_archived === 1 ? 0 : 1;
      setAllItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_archived: nextArchived } : i
        )
      );

      setSelectedVideo((prev) =>
        prev && prev.id === item.id
          ? { ...prev, is_archived: nextArchived }
          : prev
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

  // Delete Item (0ms optimistic update, single background DELETE)
  const handleDelete = useCallback(
    async (item: KeepItem) => {
      if (!confirm(`Delete "${item.title}"?`)) return;

      setAllItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        await fetch(`/api/links/${item.id}`, { method: 'DELETE' });
      } catch {
        loadItems(true);
      }
    },
    [loadItems]
  );

  // Clear All Archive Items
  const handleClearArchive = useCallback(async () => {
    if (
      !confirm(
        `Are you sure you want to permanently delete all ${stats.archiveCount} archived items? This cannot be undone.`
      )
    ) {
      return;
    }

    setClearingArchive(true);
    setAllItems((prev) => prev.filter((i) => i.is_archived === 0));

    try {
      await fetch('/api/links?scope=archive', { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear archive:', err);
      loadItems(true);
    } finally {
      setClearingArchive(false);
    }
  }, [stats.archiveCount, loadItems]);

  if (needsAuth) {
    return <PasscodeLock onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col selection:bg-indigo-500/20 relative">
      {/* Locked 3-Column Single-Row Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#08080a]/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 sm:px-6">
          {/* Left Column: Logo & Active Workspace User */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Bookmark className="h-4 w-4 fill-white" />
            </div>
            <span className="font-semibold tracking-wider text-sm text-zinc-100 hidden xs:inline">
              KEEP
            </span>
            {currentUser && (
              <span className="hidden md:inline-block rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                {currentUser.username}
              </span>
            )}
          </div>

          {/* Center Column: Filter Tabs (Locked in Center) */}
          <div className="flex justify-center overflow-x-auto">
            <FilterTabs
              activeFilter={filter}
              onFilterChange={setFilter}
              stats={stats}
            />
          </div>

          {/* Right Column: Actions & Item Count */}
          <div className="flex items-center justify-end gap-2">
            {filter === 'archive' && items.length > 0 && (
              <button
                type="button"
                onClick={handleClearArchive}
                disabled={clearingArchive}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer select-none"
                title="Permanently delete all items in Archive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Delete All</span>
              </button>
            )}

            <div className="hidden lg:flex items-center text-xs text-zinc-500 font-mono tabular-nums min-w-[60px] justify-end mr-1">
              <span>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setIsUsersModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-zinc-100 transition-colors cursor-pointer select-none"
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
      </header>

      {/* Main Uniform Grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onPlayVideo={setSelectedVideo}
                onToggleArchive={handleToggleArchive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          /* Minimal Zen Empty State */
          <div className="flex flex-col items-center justify-center py-36 text-center select-none">
            {filter === 'inbox' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101015] text-zinc-400 mb-3.5 border border-white/[0.07] shadow-inner">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400/80" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">All caught up</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  Your Watch Later queue is completely clear.
                </p>
              </>
            ) : filter === 'videos' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101015] text-zinc-400 mb-3.5 border border-white/[0.07]">
                  <Tv className="h-6 w-6 text-rose-400/80" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">No videos</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  No unwatched YouTube videos saved.
                </p>
              </>
            ) : filter === 'articles' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101015] text-zinc-400 mb-3.5 border border-white/[0.07]">
                  <FileText className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">No articles</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  No website links in queue.
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

      {/* Toast Notification (e.g. for Mobile Share Target & Actions) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#0d1512]/95 px-4 py-2 text-xs font-medium text-emerald-300 shadow-2xl shadow-black/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Static Baked-in USU Watermark in Bottom-Right Corner (Non-interactive) */}
      <div className="fixed bottom-4 right-4 z-10 pointer-events-none select-none opacity-25">
        <img
          src="/watermark.png"
          alt=""
          className="h-7 w-7 rounded-lg"
          draggable={false}
          decoding="async"
        />
      </div>

      {/* First-Time Server-Side Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          isDefaultCredentials={isDefaultCredentials}
          apiKey={setupApiKey || currentUser?.apiKey}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Admin User Management Modal */}
      {currentUser?.role === 'admin' && (
        <UserManagementModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
        />
      )}

      {/* YouTube Lightbox Modal */}
      <VideoModal
        item={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
}
