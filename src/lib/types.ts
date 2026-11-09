export type ItemType = 'youtube' | 'website';

export type UserRole = 'admin' | 'user';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  api_key: string;
  role: UserRole;
  created_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  api_key: string;
  role: UserRole;
  item_count: number;
  created_at: number;
}

export interface KeepItem {
  id: string;
  user_id: string;
  url: string;
  title: string;
  image_url: string | null;
  favicon_url: string | null;
  domain: string | null;
  item_type: ItemType;
  youtube_id: string | null;
  is_archived: number; // 0 or 1
  created_at: number; // unix timestamp in ms
  updated_at: number; // unix timestamp in ms
}

export type FilterCategory = 'inbox' | 'archive' | 'all';

export interface CreateItemInput {
  user_id: string;
  url: string;
  title?: string;
  image_url?: string | null;
  favicon_url?: string | null;
  domain?: string;
  item_type?: ItemType;
  youtube_id?: string | null;
}

export interface UpdateItemInput {
  is_archived?: boolean | number;
}

export interface ItemStats {
  inboxCount: number;
  archiveCount: number;
}
