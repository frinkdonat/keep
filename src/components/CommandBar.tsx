'use client';

import React, { useRef, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';

interface CommandBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onQuickAdd: (url: string) => Promise<void>;
  adding: boolean;
}

export function CommandBar({ query, onQueryChange, onQuickAdd, adding }: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if current query looks like a URL
  const isUrl = /^https?:\/\//i.test(query.trim()) || (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(query.trim()) && !query.includes(' '));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isUrl) {
      e.preventDefault();
      onQuickAdd(query.trim());
    }
  };

  return (
    <div className="relative w-full">
      <div className={`relative flex items-center rounded-xl border bg-zinc-900/60 transition-all duration-200 ${
        isUrl 
          ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20' 
          : 'border-zinc-800 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600'
      }`}>
        <div className="pl-3.5 pr-2 text-zinc-500">
          <Search className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search saved items or paste any URL to save..."
          className="w-full bg-transparent py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />

        <div className="flex items-center gap-2 pr-2.5">
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {isUrl ? (
            <button
              onClick={() => onQuickAdd(query.trim())}
              disabled={adding}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {adding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save URL</span>
                  <kbd className="hidden sm:inline-block rounded bg-indigo-700/60 px-1 text-[10px] text-indigo-200">
                    ↵
                  </kbd>
                </>
              )}
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 bg-zinc-950/40">
              <span>⌘K</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
