'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bookmark, 
  Plus, 
  Puzzle, 
  Loader2, 
  Sparkles, 
  Tv, 
  SearchX,
  ExternalLink
} from 'lucide-react';
import { KeepItem, FilterCategory, ItemStats } from '@/lib/types';
import { CommandBar } from '@/components/CommandBar';
import { FilterTabs } from '@/components/FilterTabs';
import { ItemCard } from '@/components/ItemCard';
import { VideoModal } from '@/components/VideoModal';
import { AddLinkModal } from '@/components/AddLinkModal';
import { ExtensionHelpModal } from '@/components/ExtensionHelpModal';
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Modals
  const [selectedVideo, setSelectedVideo] = useState<KeepItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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
  const loadItems = useCallback(async (currentFilter: FilterCategory, searchQuery: string) => {
    try {
      const params = new URLSearchParams({
        filter: currentFilter,
      });
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

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
      loadItems(filter, search);
    }
  }, [filter, search, needsAuth, authChecked, loadItems]);

  // Quick Add handler
  const handleQuickAdd = async (url: string, notes?: string) => {
    setAdding(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, notes }),
      });

      if (res.ok) {
        setSearch('');
        // Reload items
        await loadItems(filter, '');
      } else {
        alert('Failed to save link. Please verify the URL.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving link.');
    } finally {
      setAdding(false);
    }
  };

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
      // Refresh background stats
      loadItems(filter, search);
    } catch {
      // Revert if error
      loadItems(filter, search);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (item: KeepItem) => {
    const nextFav = item.is_favorite === 1 ? 0 : 1;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_favorite: nextFav } : i))
    );

    setStats((prev) => ({
      ...prev,
      favoritesCount: nextFav ? prev.favoritesCount + 1 : Math.max(0, prev.favoritesCount - 1),
    }));

    try {
      await fetch(`/api/links/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: nextFav }),
      });
    } catch {
      loadItems(filter, search);
    }
  };

  // Delete Item
  const handleDelete = async (item: KeepItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await fetch(`/api/links/${item.id}`, { method: 'DELETE' });
      loadItems(filter, search);
    } catch {
      loadItems(filter, search);
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
    return <PasscodeLock onSuccess={() => { setNeedsAuth(false); loadItems(filter, search); }} />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-indigo-500/20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Bookmark className="h-4 w-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-sm text-zinc-100">KEEP</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Server active" />
              </div>
              <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">Watch Later & Curated Library</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80 transition cursor-pointer"
              title="Setup Chrome Extension"
            >
              <Puzzle className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Chrome Extension</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Link</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {/* Command Bar (Search + Quick Add) */}
        <div className="max-w-2xl mx-auto">
          <CommandBar
            query={search}
            onQueryChange={setSearch}
            onQuickAdd={handleQuickAdd}
            adding={adding}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 pt-2">
          <FilterTabs
            activeFilter={filter}
            onFilterChange={setFilter}
            stats={stats}
          />

          <span className="text-xs text-zinc-500 font-mono hidden md:inline-block">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Links Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-xs font-mono">Loading curated links...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onPlayVideo={setSelectedVideo}
                onToggleArchive={handleToggleArchive}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 py-20 px-4 text-center">
            {search ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 mb-3">
                  <SearchX className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-medium text-zinc-300">No matching items found</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  We could not find anything matching &quot;{search}&quot;. Try a different search term or paste the link above to save it.
                </p>
                <button
                  onClick={() => setSearch('')}
                  className="mt-4 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Clear search
                </button>
              </>
            ) : filter === 'inbox' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-3 border border-indigo-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">Your Watch Later queue is empty</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md leading-relaxed">
                  Click the <strong className="text-zinc-200">Chrome Extension</strong> button to save YouTube videos and articles with 1 click, or paste any URL into the search bar above!
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add your first link</span>
                  </button>
                  <button
                    onClick={() => setIsHelpModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <Puzzle className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Get Extension</span>
                  </button>
                </div>
              </>
            ) : filter === 'videos' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 mb-3 border border-rose-500/20">
                  <Tv className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">No YouTube videos saved yet</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  Save any YouTube video to watch it right inside Keep with embedded theater mode.
                </p>
              </>
            ) : filter === 'archive' ? (
              <>
                <h3 className="text-sm font-medium text-zinc-400">Archive is empty</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Items you mark as &quot;Done&quot; or &quot;Watched&quot; will be stored here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium text-zinc-400">No items in this view</h3>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600 font-mono">
        Keep — Minimalist Watch Later & Bookmarks
      </footer>

      {/* YouTube Lightbox Modal */}
      <VideoModal
        item={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onToggleArchive={handleToggleArchive}
      />

      {/* Add Link Modal */}
      <AddLinkModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleQuickAdd}
      />

      {/* Chrome Extension Setup Modal */}
      <ExtensionHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}
