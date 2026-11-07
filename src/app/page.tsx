'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bookmark, 
  Loader2, 
  CheckCircle2,
  Tv, 
  Archive,
  FileText,
  Trash2
} from 'lucide-react';
import { KeepItem, FilterCategory, ItemStats } from '@/lib/types';
import { FilterTabs } from '@/components/FilterTabs';
import { ItemCard } from '@/components/ItemCard';
import { VideoModal } from '@/components/VideoModal';
import { PasscodeLock } from '@/components/PasscodeLock';

export default function HomePage() {
  const [items, setItems] = useState<KeepItem[]>([]);
  const [stats, setStats] = useState<ItemStats>({
    inboxCount: 0,
    videosCount: 0,
    articlesCount: 0,
    favoritesCount: 0,
    archiveCount: 0,
    totalCount: 0,
  });
  const [filter, setFilter] = useState<FilterCategory>('inbox');
  const [loading, setLoading] = useState(true);
  const [clearingArchive, setClearingArchive] = useState(false);

  // Modals
  const [selectedVideo, setSelectedVideo] = useState<KeepItem | null>(null);

  // Authentication State
  const [authChecked, setAuthChecked] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Check auth requirement on load
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.required && !data.authenticated) {
          setNeedsAuth(true);
        } else {
          setNeedsAuth(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load items
  const loadItems = useCallback(async (currentFilter: FilterCategory) => {
    try {
      const params = new URLSearchParams({
        filter: currentFilter,
      });

      const res = await fetch(`/api/links?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load links:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!needsAuth && authChecked) {
      loadItems(filter);
    }
  }, [filter, needsAuth, authChecked, loadItems]);

  // Toggle Archive (Mark watched / Inbox)
  const handleToggleArchive = async (item: KeepItem) => {
    const nextArchived = item.is_archived === 1 ? 0 : 1;
    // Optimistic UI update
    setItems((prev) =>
      filter === 'all'
        ? prev.map((i) => (i.id === item.id ? { ...i, is_archived: nextArchived } : i))
        : prev.filter((i) => i.id !== item.id)
    );

    // Update stats optimistically
    setStats((prev) => ({
      ...prev,
      inboxCount: nextArchived ? Math.max(0, prev.inboxCount - 1) : prev.inboxCount + 1,
      archiveCount: nextArchived ? prev.archiveCount + 1 : Math.max(0, prev.archiveCount - 1),
    }));

    if (selectedVideo?.id === item.id) {
      setSelectedVideo((prev) => prev ? { ...prev, is_archived: nextArchived } : null);
    }

    try {
      await fetch(`/api/links/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: nextArchived }),
      });
      loadItems(filter);
    } catch {
      loadItems(filter);
    }
  };

  // Delete Item
  const handleDelete = async (item: KeepItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await fetch(`/api/links/${item.id}`, { method: 'DELETE' });
      loadItems(filter);
    } catch {
      loadItems(filter);
    }
  };

  // Clear All Archive Items
  const handleClearArchive = async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${items.length} archived items? This cannot be undone.`)) {
      return;
    }

    setClearingArchive(true);
    setItems([]);
    setStats((prev) => ({ ...prev, archiveCount: 0 }));

    try {
      await fetch('/api/links?scope=archive', { method: 'DELETE' });
      await loadItems('archive');
    } catch (err) {
      console.error('Failed to clear archive:', err);
      loadItems('archive');
    } finally {
      setClearingArchive(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (needsAuth) {
    return <PasscodeLock onSuccess={() => { setNeedsAuth(false); loadItems(filter); }} />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-indigo-500/20">
      {/* Streamlined Single-Row Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Logo (No green dot) */}
          <div className="flex items-center gap-2.5 flex-shrink-0 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Bookmark className="h-4 w-4 fill-white" />
            </div>
            <span className="font-semibold tracking-wider text-sm text-zinc-100">KEEP</span>
          </div>

          {/* Filter Tabs in the Header */}
          <div className="flex-1 flex justify-center sm:justify-start overflow-x-auto">
            <FilterTabs
              activeFilter={filter}
              onFilterChange={setFilter}
              stats={stats}
            />
          </div>

          {/* Header Right Actions (Clear Archive or Item Count) */}
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            {filter === 'archive' && items.length > 0 && (
              <button
                onClick={handleClearArchive}
                disabled={clearingArchive}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                title="Permanently delete all items in Archive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete All</span>
              </button>
            )}

            <div className="hidden sm:flex items-center text-xs text-zinc-500 font-mono">
              <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500 mb-2.5" />
            <p className="text-xs font-mono">Loading...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <div className="flex flex-col items-center justify-center py-32 text-center">
            {filter === 'inbox' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900/80 text-zinc-400 mb-3 border border-zinc-800/80 shadow-inner">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400/80" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300">All caught up</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  Your Watch Later queue is completely clear.
                </p>
              </>
            ) : filter === 'videos' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900/80 text-zinc-400 mb-3 border border-zinc-800/80">
                  <Tv className="h-6 w-6 text-rose-400/80" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300">No videos</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  No unwatched YouTube videos saved.
                </p>
              </>
            ) : filter === 'articles' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900/80 text-zinc-400 mb-3 border border-zinc-800/80">
                  <FileText className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300">No articles</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  No website links in queue.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900/80 text-zinc-400 mb-3 border border-zinc-800/80">
                  <Archive className="h-6 w-6 text-zinc-500" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400">Archive empty</h3>
              </>
            )}
          </div>
        )}
      </main>

      {/* YouTube Lightbox Modal */}
      <VideoModal
        item={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
}
