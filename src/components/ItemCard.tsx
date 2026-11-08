'use client';

import React, { useState, useEffect, memo } from 'react';
import {
  Play,
  Check,
  RotateCcw,
  Trash2,
  Globe,
} from 'lucide-react';
import { KeepItem } from '@/lib/types';
import { formatRelativeTime, cleanDomain } from '@/lib/utils';

interface ItemCardProps {
  item: KeepItem;
  onToggleArchive: (item: KeepItem) => void;
  onDelete: (item: KeepItem) => void;
}

function YouTubeBadgeIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6" fill="#FF0033" />
      <path d="M10 8.2L16.2 12L10 15.8V8.2Z" fill="#FFFFFF" />
    </svg>
  );
}

export const ItemCard = memo(function ItemCard({
  item,
  onToggleArchive,
  onDelete,
}: ItemCardProps) {
  const isVideo = item.item_type === 'youtube' && Boolean(item.youtube_id);
  const domainLabel = cleanDomain(item.domain) || 'website';
  const isYouTubeDomain = isVideo || domainLabel === 'youtube.com' || domainLabel === 'youtu.be';
  const safeHref = /^https?:\/\//i.test(item.url) ? item.url : '#';

  const defaultVideoThumb = item.youtube_id
    ? `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`
    : null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(item.image_url || defaultVideoThumb);
  const [imgError, setImgError] = useState(!(item.image_url || defaultVideoThumb));
  const [faviconError, setFaviconError] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const handleImgError = () => {
    if (item.youtube_id && imgSrc && !imgSrc.includes('hqdefault.jpg')) {
      setImgSrc(`https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`);
      setImgError(false);
    } else if (item.youtube_id && imgSrc && imgSrc.includes('hqdefault.jpg')) {
      setImgSrc(`https://i.ytimg.com/vi/${item.youtube_id}/mqdefault.jpg`);
      setImgError(false);
    } else {
      setImgError(true);
    }
  };

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (
      item.youtube_id &&
      e.currentTarget.naturalWidth === 120 &&
      imgSrc &&
      imgSrc.includes('maxresdefault.jpg')
    ) {
      setImgSrc(`https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(item);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleArchive(item);
  };

  return (
    <div className="group relative flex h-[284px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101015] transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-[#13131a] hover:shadow-xl hover:shadow-black/50">
      {/* Whole-Card Tap/Click Target (Direct Native Opening) */}
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col overflow-hidden group/link focus:outline-none"
      >
        {/* 16:9 Media Cover */}
        <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-zinc-950">
          {imgSrc && !imgError ? (
            <img
              src={imgSrc}
              alt={item.title}
              onError={handleImgError}
              onLoad={isVideo ? handleImgLoad : undefined}
              className="h-full w-full object-cover transform-gpu transition-transform duration-300 group-hover/link:scale-105"
              decoding="async"
            />
          ) : isVideo ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-950/30 via-zinc-950 to-zinc-950">
              <Play className="h-10 w-10 text-zinc-600" />
            </div>
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#151521] via-[#0f0f16] to-[#0a0a0e]">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
              <div className="relative flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#161620] px-3.5 py-2 shadow-inner">
                {isYouTubeDomain ? (
                  <YouTubeBadgeIcon className="h-4 w-4" />
                ) : item.favicon_url && !faviconError ? (
                  <img
                    src={item.favicon_url}
                    alt=""
                    onError={() => setFaviconError(true)}
                    className="h-4 w-4 rounded-sm"
                    decoding="async"
                  />
                ) : (
                  <Globe className="h-4 w-4 text-indigo-400" />
                )}
                <span className="max-w-[160px] truncate font-mono text-xs font-medium text-zinc-300">
                  {domainLabel}
                </span>
              </div>
            </div>
          )}

          {isVideo && (
            <>
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-200 group-hover/link:bg-black/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-black/60 transform-gpu transition-transform duration-200 group-hover/link:scale-110">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </div>
              </div>

              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/80 px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>YouTube</span>
              </div>
            </>
          )}
        </div>

        {/* Clean Content Body: Favicon + Domain + Time + 2-Line Title */}
        <div className="flex flex-1 flex-col justify-start px-4 pt-3 pb-2 min-h-0">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              {isYouTubeDomain ? (
                <YouTubeBadgeIcon className="h-3.5 w-3.5" />
              ) : item.favicon_url && !faviconError ? (
                <img
                  src={item.favicon_url}
                  alt=""
                  onError={() => setFaviconError(true)}
                  className="h-3.5 w-3.5 flex-shrink-0 rounded-sm"
                  decoding="async"
                />
              ) : (
                <Globe className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              )}
              <span className="truncate font-mono text-[11px] text-zinc-400">
                {domainLabel}
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 flex-shrink-0 font-mono tabular-nums">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>

          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-100 group-hover/link:text-indigo-300 transition-colors">
            {item.title}
          </h3>
        </div>
      </a>

      {/* Minimal 2-Button Action Footer: Done/Restore on Left, Delete on Right */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-t border-white/[0.06] bg-black/25 px-3">
        <button
          type="button"
          onClick={handleArchiveClick}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none ${
            item.is_archived
              ? 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              : 'text-emerald-400 hover:bg-emerald-500/10'
          }`}
          title={item.is_archived ? 'Move to Watch Later' : 'Mark as Done'}
        >
          {item.is_archived ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="text-[11px]">Restore</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="text-[11px]">Done</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDeleteClick}
          className={`rounded-lg transition-colors cursor-pointer select-none ${
            confirmDelete
              ? 'bg-rose-500/20 border border-rose-500/35 px-2 py-0.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30'
              : 'p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400'
          }`}
          title={confirmDelete ? 'Click again to permanently delete' : 'Delete permanently'}
        >
          {confirmDelete ? 'Sure?' : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
});
