export type ItemType = 'youtube' | 'website';

export type UserRole = 'admin' | 'user';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  api_key: string;
  role: UserRole;
  setup_completed: number; // 0 or 1
  created_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  api_key: string;
  role: UserRole;
  setup_completed: boolean;
  item_count: number;
  created_at: number;
}

export interface KeepItem {
  id: string;
  user_id: string;
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

export type FilterCategory = 'inbox' | 'videos' | 'articles' | 'archive' | 'all';

export interface CreateItemInput {
  user_id: string;
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
