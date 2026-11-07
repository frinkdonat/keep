'use client';

import React from 'react';
import { Inbox, Video, Newspaper, Star, Archive } from 'lucide-react';
import { FilterCategory, ItemStats } from '@/lib/types';

interface FilterTabsProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  stats: ItemStats;
}

export function FilterTabs({ activeFilter, onFilterChange, stats }: FilterTabsProps) {
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
      id: 'favorites' as FilterCategory,
      label: 'Favorites',
      icon: Star,
      count: stats.favoritesCount,
    },
    {
      id: 'archive' as FilterCategory,
      label: 'Archive',
      icon: Archive,
      count: stats.archiveCount,
    },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeFilter === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              isActive
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                isActive
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'bg-zinc-900 text-zinc-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
