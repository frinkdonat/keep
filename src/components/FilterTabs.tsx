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
      icon: Inbox,
      count: stats.inboxCount,
    },
    {
      id: 'videos' as FilterCategory,
      label: 'Videos',
      icon: Video,
      count: stats.videosCount,
    },
    {
      id: 'articles' as FilterCategory,
      label: 'Articles & Sites',
      icon: Newspaper,
      count: stats.articlesCount,
    },
    {
      id: 'archive' as FilterCategory,
      label: 'Archive',
      icon: Archive,
      count: stats.archiveCount,
    },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.06] bg-[#101015]/80 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeFilter === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer select-none ${
              isActive
                ? 'bg-white/[0.09] text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
            <span>{tab.label}</span>
            <span
              className={`min-w-[20px] rounded-md px-1.5 py-0.5 text-center text-[10px] font-mono tabular-nums transition-colors ${
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
