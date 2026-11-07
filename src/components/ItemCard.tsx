'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  Play, 
  Check, 
  RotateCcw, 
  Star, 
  Trash2, 
  ExternalLink, 
  Copy, 
  CheckCheck,
  Globe
} from 'lucide-react';
import { KeepItem } from '@/lib/types';
import { formatRelativeTime, cleanDomain } from '@/lib/utils';

interface ItemCardProps {
  item: KeepItem;
  onPlayVideo: (item: KeepItem) => void;
  onToggleArchive: (item: KeepItem) => void;
  onToggleFavorite: (item: KeepItem) => void;
  onDelete: (item: KeepItem) => void;
}

export function ItemCard({
  item,
  onPlayVideo,
  onToggleArchive,
  onToggleFavorite,
  onDelete,
}: ItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isVideo = item.item_type === 'youtube' && item.youtube_id;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-xl hover:shadow-black/40">
      <div>
        {/* Visual Header / Media Preview */}
        {isVideo ? (
          <div 
            onClick={() => onPlayVideo(item)}
            className="relative aspect-video w-full overflow-hidden bg-zinc-950 cursor-pointer group/thumb"
          >
            {item.image_url && !imgError ? (
              <img
                src={item.image_url}
                alt={item.title}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                <Play className="h-10 w-10 text-zinc-600" />
              </div>
            )}

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-all duration-200 group-hover/thumb:bg-black/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600/90 text-white shadow-lg shadow-black/50 backdrop-blur-sm transition-transform duration-200 group-hover/thumb:scale-110">
                <Play className="h-5 w-5 fill-current ml-0.5" />
              </div>
            </div>

            {/* YouTube Tag */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>YouTube</span>
            </div>
          </div>
        ) : item.image_url && !imgError ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block aspect-[16/9] w-full overflow-hidden bg-zinc-950"
          >
            <img
              src={item.image_url}
              alt={item.title}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </a>
        ) : null}

        {/* Content Body */}
        <div className="p-4">
          {/* Domain & Time metadata */}
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              {item.favicon_url ? (
                <img
                  src={item.favicon_url}
                  alt=""
                  className="h-3.5 w-3.5 flex-shrink-0 rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
              )}
              <span className="truncate font-mono text-[11px] text-zinc-400">
                {cleanDomain(item.domain)}
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 flex-shrink-0 font-mono">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">
            {isVideo ? (
              <button
                onClick={() => onPlayVideo(item)}
                className="text-left hover:underline cursor-pointer"
              >
                {item.title}
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {item.title}
              </a>
            )}
          </h3>

          {/* Description snippet if available */}
          {item.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Notes if user added any */}
          {item.notes && (
            <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200/90 font-mono">
              {item.notes}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800/60 bg-zinc-950/40 px-3.5 py-2 mt-2">
        <div className="flex items-center gap-1">
          {/* Toggle Archive / Watched */}
          <button
            onClick={() => onToggleArchive(item)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition cursor-pointer ${
              item.is_archived
                ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
            title={item.is_archived ? 'Move to Inbox' : 'Mark as Watched / Done'}
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

          {/* Toggle Favorite */}
          <button
            onClick={() => onToggleFavorite(item)}
            className={`rounded-md p-1.5 transition cursor-pointer ${
              item.is_favorite
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-amber-400'
            }`}
            title={item.is_favorite ? 'Remove Favorite' : 'Add to Favorites'}
          >
            <Star className={`h-3.5 w-3.5 ${item.is_favorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Copy link */}
          <button
            onClick={handleCopy}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition cursor-pointer"
            title="Copy URL"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {/* External link */}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Open original website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Delete */}
          <button
            onClick={() => onDelete(item)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
            title="Delete permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
