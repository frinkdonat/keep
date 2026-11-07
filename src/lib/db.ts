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

  // Performance optimizations: WAL mode & memory cache
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -8000;'); // ~8MB cache
  db.exec('PRAGMA temp_store = MEMORY;');

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

    CREATE INDEX IF NOT EXISTS idx_links_archived_created ON links (is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_type_archived ON links (item_type, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_url ON links (url);
  `);

  global.__keep_db__ = db;
  return db;
}

export const db = {
  getAll(filter: FilterCategory = 'inbox'): KeepItem[] {
    const database = getDatabase();
    let sql = 'SELECT * FROM links WHERE is_archived = 0 ORDER BY created_at DESC';

    switch (filter) {
      case 'videos':
        sql = "SELECT * FROM links WHERE item_type = 'youtube' AND is_archived = 0 ORDER BY created_at DESC";
        break;
      case 'articles':
        sql = "SELECT * FROM links WHERE item_type = 'website' AND is_archived = 0 ORDER BY created_at DESC";
        break;
      case 'archive':
        sql = 'SELECT * FROM links WHERE is_archived = 1 ORDER BY created_at DESC';
        break;
      case 'all':
        sql = 'SELECT * FROM links ORDER BY created_at DESC';
        break;
      case 'inbox':
      default:
        sql = 'SELECT * FROM links WHERE is_archived = 0 ORDER BY created_at DESC';
        break;
    }

    const stmt = database.prepare(sql);
    return stmt.all() as unknown as KeepItem[];
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
    const statsQuery = database.prepare(`
      SELECT
        COUNT(CASE WHEN is_archived = 0 THEN 1 END) as inboxCount,
        COUNT(CASE WHEN item_type = 'youtube' AND is_archived = 0 THEN 1 END) as videosCount,
        COUNT(CASE WHEN item_type = 'website' AND is_archived = 0 THEN 1 END) as articlesCount,
        COUNT(CASE WHEN is_archived = 1 THEN 1 END) as archiveCount,
        COUNT(*) as totalCount
      FROM links
    `).get() as {
      inboxCount: number | bigint;
      videosCount: number | bigint;
      articlesCount: number | bigint;
      archiveCount: number | bigint;
      totalCount: number | bigint;
    };

    return {
      inboxCount: Number(statsQuery.inboxCount),
      videosCount: Number(statsQuery.videosCount),
      articlesCount: Number(statsQuery.articlesCount),
      favoritesCount: 0,
      archiveCount: Number(statsQuery.archiveCount),
      totalCount: Number(statsQuery.totalCount),
    };
  }
};
