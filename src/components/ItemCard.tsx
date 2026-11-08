'use client';

import React, { useState, memo } from 'react';
import {
  Play,
  Check,
  RotateCcw,
  Trash2,
  ExternalLink,
  Copy,
  CheckCheck,
  Globe,
} from 'lucide-react';
import { KeepItem } from '@/lib/types';
import { formatRelativeTime, cleanDomain } from '@/lib/utils';

interface ItemCardProps {
  item: KeepItem;
  onPlayVideo: (item: KeepItem) => void;
  onToggleArchive: (item: KeepItem) => void;
  onDelete: (item: KeepItem) => void;
}

export const ItemCard = memo(function ItemCard({
  item,
  onPlayVideo,
  onToggleArchive,
  onDelete,
}: ItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const isVideo = item.item_type === 'youtube' && Boolean(item.youtube_id);
  const domainLabel = cleanDomain(item.domain) || 'website';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex h-[324px] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101015]/85 backdrop-blur-sm transform-gpu transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-[#13131a] hover:shadow-2xl hover:shadow-black/60 [content-visibility:auto] [contain-intrinsic-size:0_324px]">
      {/* Uniform 16:9 Top Media Header for ALL Cards */}
      {isVideo ? (
        <div
          onClick={() => onPlayVideo(item)}
          className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-zinc-950 cursor-pointer group/thumb"
        >
          {item.image_url && !imgError ? (
            <img
              src={item.image_url}
              alt={item.title}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transform-gpu transition-transform duration-300 group-hover/thumb:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-950/30 via-zinc-950 to-zinc-950">
              <Play className="h-10 w-10 text-zinc-600" />
            </div>
          )}

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-200 group-hover/thumb:bg-black/45">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600/95 text-white shadow-lg shadow-black/60 backdrop-blur-sm transform-gpu transition-transform duration-200 group-hover/thumb:scale-110">
              <Play className="h-4 w-4 fill-current ml-0.5" />
            </div>
          </div>

          {/* YouTube Pill */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-0.5 text-[10px] font-medium text-zinc-200 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>YouTube</span>
          </div>
        </div>
      ) : (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-video w-full flex-shrink-0 overflow-hidden bg-zinc-950 group/thumb"
        >
          {item.image_url && !imgError ? (
            <img
              src={item.image_url}
              alt={item.title}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transform-gpu transition-transform duration-300 group-hover/thumb:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            /* Sleek Fallback Cover for Websites without an OpenGraph Image */
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#151521] via-[#0f0f16] to-[#0a0a0e]">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
              <div className="relative flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 backdrop-blur-md shadow-inner transform-gpu transition-transform duration-300 group-hover/thumb:scale-105">
                {item.favicon_url && !faviconError ? (
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
        </a>
      )}

      {/* Fixed-Height Content Body */}
      <div className="flex flex-1 flex-col justify-between px-4 pt-3 pb-2 min-h-0">
        <div>
          {/* Domain & Time metadata */}
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              {item.favicon_url && !faviconError ? (
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

          {/* Title */}
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-100 group-hover:text-white">
            {isVideo ? (
              <button
                type="button"
                onClick={() => onPlayVideo(item)}
                className="text-left hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {item.title}
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-300 transition-colors"
              >
                {item.title}
              </a>
            )}
          </h3>
        </div>

        {/* Single-line description or domain fallback */}
        <p className="line-clamp-1 text-[11px] text-zinc-500">
          {item.description || item.url}
        </p>
      </div>

      {/* Uniform Action Footer */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-t border-white/[0.06] bg-black/25 px-3">
        <button
          type="button"
          onClick={() => onToggleArchive(item)}
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

        <div className="flex items-center gap-0.5">
          {/* Copy link */}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors cursor-pointer"
            title="Copy URL"
          >
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* External link */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            title="Open original link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
            title="Delete permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
