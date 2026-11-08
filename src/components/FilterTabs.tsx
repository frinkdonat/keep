'use client';

import React, { memo } from 'react';
import { Inbox, Video, Newspaper, Archive } from 'lucide-react';
import { FilterCategory, ItemStats } from '@/lib/types';

interface FilterTabsProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  stats: ItemStats;
}

export const FilterTabs = memo(function FilterTabs({
  activeFilter,
  onFilterChange,
  stats,
}: FilterTabsProps) {
  const tabs = [
    {
      id: 'inbox' as FilterCategory,
      label: 'Watch Later',
      shortLabel: 'Watch Later',
      icon: Inbox,
      count: stats.inboxCount,
    },
    {
      id: 'videos' as FilterCategory,
      label: 'Videos',
      shortLabel: 'Videos',
      icon: Video,
      count: stats.videosCount,
    },
    {
      id: 'articles' as FilterCategory,
      label: 'Articles & Sites',
      shortLabel: 'Articles',
      icon: Newspaper,
      count: stats.articlesCount,
    },
    {
      id: 'archive' as FilterCategory,
      label: 'Archive',
      shortLabel: 'Archive',
      icon: Archive,
      count: stats.archiveCount,
    },
  ];

  return (
    <div className="grid w-full grid-cols-4 gap-1 sm:inline-flex sm:w-auto sm:items-center rounded-xl border border-white/[0.06] bg-[#101015]/80 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeFilter === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-lg px-1.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors duration-150 cursor-pointer select-none min-w-0 ${
              isActive
                ? 'bg-white/[0.09] text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden truncate">{tab.shortLabel}</span>
            <span
              className={`min-w-[16px] sm:min-w-[20px] flex-shrink-0 rounded-md px-1 sm:px-1.5 py-0.5 text-center text-[10px] font-mono tabular-nums transition-colors ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-white/[0.04] text-zinc-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
});
