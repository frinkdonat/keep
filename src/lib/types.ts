export type ItemType = 'youtube' | 'website';

export interface KeepItem {
  id: string;
  url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  domain: string | null;
  item_type: ItemType;
  youtube_id: string | null;
  is_archived: number; // 0 or 1
  is_favorite: number; // 0 or 1
  notes: string | null;
  created_at: number; // unix timestamp in ms
  updated_at: number; // unix timestamp in ms
}

export type FilterCategory = 'inbox' | 'videos' | 'articles' | 'favorites' | 'archive' | 'all';

export interface CreateItemInput {
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  favicon_url?: string;
  domain?: string;
  item_type?: ItemType;
  youtube_id?: string;
  notes?: string;
}

export interface UpdateItemInput {
  title?: string;
  description?: string;
  is_archived?: boolean | number;
  is_favorite?: boolean | number;
  notes?: string;
}

export interface ItemStats {
  inboxCount: number;
  videosCount: number;
  articlesCount: number;
  favoritesCount: number;
  archiveCount: number;
  totalCount: number;
}
