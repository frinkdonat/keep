import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { KeepItem, CreateItemInput, UpdateItemInput, FilterCategory, ItemStats } from './types';

// Global declaration for singleton across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __keep_db__: DatabaseSync | undefined;
}

function getDatabase(): DatabaseSync {
  if (global.__keep_db__) {
    return global.__keep_db__;
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'keep.db');
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrency and performance
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');

  // Create links table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      favicon_url TEXT,
      domain TEXT,
      item_type TEXT DEFAULT 'website',
      youtube_id TEXT,
      is_archived INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_created ON links (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_archived ON links (is_archived);
    CREATE INDEX IF NOT EXISTS idx_links_type ON links (item_type);
  `);

  global.__keep_db__ = db;
  return db;
}

export const db = {
  getAll(filter: FilterCategory = 'inbox', search?: string): KeepItem[] {
    const database = getDatabase();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Filter conditions
    switch (filter) {
      case 'inbox':
        conditions.push('is_archived = 0');
        break;
      case 'videos':
        conditions.push("item_type = 'youtube' AND is_archived = 0");
        break;
      case 'articles':
        conditions.push("item_type = 'website' AND is_archived = 0");
        break;
      case 'favorites':
        conditions.push('is_favorite = 1 AND is_archived = 0');
        break;
      case 'archive':
        conditions.push('is_archived = 1');
        break;
      case 'all':
      default:
        // no extra condition
        break;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(title LIKE ? OR url LIKE ? OR description LIKE ? OR domain LIKE ? OR notes LIKE ?)');
      params.push(term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM links ${whereClause} ORDER BY created_at DESC`;

    const stmt = database.prepare(sql);
    return stmt.all(...params) as unknown as KeepItem[];
  },

  getById(id: string): KeepItem | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM links WHERE id = ?');
    const result = stmt.get(id);
    return (result as unknown as KeepItem) || null;
  },

  getByUrl(url: string): KeepItem | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM links WHERE url = ?');
    const result = stmt.get(url);
    return (result as unknown as KeepItem) || null;
  },

  create(input: CreateItemInput): KeepItem {
    const database = getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();

    const stmt = database.prepare(`
      INSERT INTO links (
        id, url, title, description, image_url, favicon_url, domain,
        item_type, youtube_id, is_archived, is_favorite, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.url,
      input.title || input.url,
      input.description || null,
      input.image_url || null,
      input.favicon_url || null,
      input.domain || null,
      input.item_type || 'website',
      input.youtube_id || null,
      input.notes || null,
      now,
      now
    );

    return this.getById(id)!;
  },

  update(id: string, input: UpdateItemInput): KeepItem | null {
    const database = getDatabase();
    const existing = this.getById(id);
    if (!existing) return null;

    const fields: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [Date.now()];

    if (input.title !== undefined) {
      fields.push('title = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description);
    }
    if (input.is_archived !== undefined) {
      fields.push('is_archived = ?');
      params.push(input.is_archived ? 1 : 0);
    }
    if (input.is_favorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(input.is_favorite ? 1 : 0);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      params.push(input.notes);
    }

    params.push(id);
    const sql = `UPDATE links SET ${fields.join(', ')} WHERE id = ?`;
    database.prepare(sql).run(...params);

    return this.getById(id);
  },

  delete(id: string): boolean {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM links WHERE id = ?');
    const result = stmt.run(id);
    return Number(result.changes) > 0;
  },

  clearArchive(): number {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM links WHERE is_archived = 1');
    const result = stmt.run();
    return Number(result.changes);
  },

  getStats(): ItemStats {
    const database = getDatabase();
    const inbox = database.prepare('SELECT COUNT(*) as count FROM links WHERE is_archived = 0').get() as { count: number | bigint };
    const videos = database.prepare("SELECT COUNT(*) as count FROM links WHERE item_type = 'youtube' AND is_archived = 0").get() as { count: number | bigint };
    const articles = database.prepare("SELECT COUNT(*) as count FROM links WHERE item_type = 'website' AND is_archived = 0").get() as { count: number | bigint };
    const favorites = database.prepare('SELECT COUNT(*) as count FROM links WHERE is_favorite = 1 AND is_archived = 0').get() as { count: number | bigint };
    const archive = database.prepare('SELECT COUNT(*) as count FROM links WHERE is_archived = 1').get() as { count: number | bigint };
    const total = database.prepare('SELECT COUNT(*) as count FROM links').get() as { count: number | bigint };

    return {
      inboxCount: Number(inbox.count),
      videosCount: Number(videos.count),
      articlesCount: Number(articles.count),
      favoritesCount: Number(favorites.count),
      archiveCount: Number(archive.count),
      totalCount: Number(total.count),
    };
  }
};
