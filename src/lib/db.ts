import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  KeepItem,
  CreateItemInput,
  UpdateItemInput,
  FilterCategory,
  ItemStats,
  UserRecord,
  PublicUser,
} from './types';

export const DUMMY_DEFAULTS = {
  USERNAME: 'admin',
  PASSWORD: 'changeme',
  API_KEY: 'keep_secret_api_key',
};

export function getEnvAdminConfig() {
  let rawUser =
    process.env.KEEP_USERNAME ||
    process.env.APP_USERNAME ||
    process.env.USERNAME ||
    DUMMY_DEFAULTS.USERNAME;

  if (
    process.platform === 'win32' &&
    !process.env.KEEP_USERNAME &&
    !process.env.APP_USERNAME &&
    rawUser === os.userInfo().username
  ) {
    rawUser = DUMMY_DEFAULTS.USERNAME;
  }

  const username = rawUser.trim();
  const password = (
    process.env.KEEP_PASSWORD ||
    process.env.APP_PASSWORD ||
    process.env.PASSWORD ||
    DUMMY_DEFAULTS.PASSWORD
  ).trim();
  const apiKey = (process.env.API_KEY || DUMMY_DEFAULTS.API_KEY).trim();

  const isDefaultCredentials =
    username === DUMMY_DEFAULTS.USERNAME ||
    password === DUMMY_DEFAULTS.PASSWORD ||
    apiKey === DUMMY_DEFAULTS.API_KEY;

  return { username, password, apiKey, isDefaultCredentials };
}

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function generateApiKey(): string {
  return 'keep_sec_' + crypto.randomBytes(24).toString('hex');
}

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
  const database = new DatabaseSync(dbPath);

  // Performance optimizations: WAL mode, memory cache & mmap
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA synchronous = NORMAL;');
  database.exec('PRAGMA cache_size = -16000;');
  database.exec('PRAGMA temp_store = MEMORY;');
  database.exec('PRAGMA mmap_size = 67108864;');

  // Create tables
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      setup_completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'admin',
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe migration: ensure user_id column exists on existing links table
  const columns = database.prepare('PRAGMA table_info(links)').all() as Array<{ name: string }>;
  const hasUserId = columns.some((c) => c.name === 'user_id');
  if (!hasUserId) {
    database.exec("ALTER TABLE links ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin';");
  }

  // Create composite indexes for per-user workspace isolation
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_links_user_archived_created ON links (user_id, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_type_archived ON links (user_id, item_type, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_url ON links (user_id, url);
  `);

  // Ensure primary admin user is synced with Docker environment variables
  const envAdmin = getEnvAdminConfig();
  const existingAdmin = database
    .prepare("SELECT * FROM users WHERE id = 'admin'")
    .get() as unknown as UserRecord | undefined;

  if (!existingAdmin) {
    const legacySetup = database
      .prepare("SELECT value FROM settings WHERE key = 'onboarding_completed'")
      .get() as { value: string } | undefined;
    const setupDone = legacySetup?.value === '1' ? 1 : 0;

    database
      .prepare(
        `INSERT INTO users (id, username, password_hash, api_key, role, setup_completed, created_at)
         VALUES ('admin', ?, ?, ?, 'admin', ?, ?)`
      )
      .run(
        envAdmin.username,
        hashPassword(envAdmin.password),
        envAdmin.apiKey,
        setupDone,
        Date.now()
      );
  } else {
    // Sync if Docker env vars changed
    const usernameChanged = existingAdmin.username !== envAdmin.username;
    const apiKeyChanged = existingAdmin.api_key !== envAdmin.apiKey;
    const passwordChanged = !verifyPassword(envAdmin.password, existingAdmin.password_hash);

    if (usernameChanged || apiKeyChanged || passwordChanged) {
      database
        .prepare(
          `UPDATE users SET username = ?, password_hash = ?, api_key = ? WHERE id = 'admin'`
        )
        .run(
          envAdmin.username,
          passwordChanged ? hashPassword(envAdmin.password) : existingAdmin.password_hash,
          envAdmin.apiKey
        );
    }
  }

  global.__keep_db__ = database;
  return database;
}

export const db = {
  // --- USER MANAGEMENT ---
  getUserById(id: string): UserRecord | null {
    const database = getDatabase();
    const row = database.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return (row as unknown as UserRecord) || null;
  },

  getUserByUsername(username: string): UserRecord | null {
    const database = getDatabase();
    const row = database
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username.trim());
    return (row as unknown as UserRecord) || null;
  },

  getUserByApiKey(apiKey: string): UserRecord | null {
    const database = getDatabase();
    const row = database.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey.trim());
    return (row as unknown as UserRecord) || null;
  },

  getAllUsers(): PublicUser[] {
    const database = getDatabase();
    const rows = database
      .prepare(
        `SELECT 
          u.id, u.username, u.api_key, u.role, u.setup_completed, u.created_at,
          COUNT(l.id) as item_count
         FROM users u
         LEFT JOIN links l ON l.user_id = u.id
         GROUP BY u.id
         ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at ASC`
      )
      .all() as Array<{
      id: string;
      username: string;
      api_key: string;
      role: 'admin' | 'user';
      setup_completed: number;
      created_at: number;
      item_count: number | bigint;
    }>;

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      api_key: r.api_key,
      role: r.role,
      setup_completed: r.setup_completed === 1,
      item_count: Number(r.item_count),
      created_at: r.created_at,
    }));
  },

  createUser(username: string, password: string): PublicUser {
    const database = getDatabase();
    const cleanUsername = username.trim();
    const existing = this.getUserByUsername(cleanUsername);
    if (existing) {
      throw new Error('Username already exists');
    }

    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const passHash = hashPassword(password);
    const now = Date.now();

    database
      .prepare(
        `INSERT INTO users (id, username, password_hash, api_key, role, setup_completed, created_at)
         VALUES (?, ?, ?, ?, 'user', 0, ?)`
      )
      .run(id, cleanUsername, passHash, apiKey, now);

    return {
      id,
      username: cleanUsername,
      api_key: apiKey,
      role: 'user',
      setup_completed: false,
      item_count: 0,
      created_at: now,
    };
  },

  updateUser(
    id: string,
    updates: { password?: string; regenerateApiKey?: boolean }
  ): PublicUser | null {
    const database = getDatabase();
    const user = this.getUserById(id);
    if (!user) return null;

    if (updates.password) {
      database
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(hashPassword(updates.password), id);
    }

    if (updates.regenerateApiKey) {
      database
        .prepare('UPDATE users SET api_key = ? WHERE id = ?')
        .run(generateApiKey(), id);
    }

    const updated = this.getUserById(id)!;
    const countRow = database
      .prepare('SELECT COUNT(*) as c FROM links WHERE user_id = ?')
      .get(id) as { c: number | bigint };

    return {
      id: updated.id,
      username: updated.username,
      api_key: updated.api_key,
      role: updated.role,
      setup_completed: updated.setup_completed === 1,
      item_count: Number(countRow.c),
      created_at: updated.created_at,
    };
  },

  deleteUser(id: string): boolean {
    if (id === 'admin') return false; // Cannot delete the primary admin account
    const database = getDatabase();
    database.prepare('DELETE FROM links WHERE user_id = ?').run(id);
    const result = database.prepare('DELETE FROM users WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  },

  markUserSetupCompleted(userId: string): void {
    const database = getDatabase();
    database.prepare('UPDATE users SET setup_completed = 1 WHERE id = ?').run(userId);
  },

  // --- WORKSPACE-ISOLATED LINKS ---
  getAll(userId: string, filter: FilterCategory = 'inbox'): KeepItem[] {
    const database = getDatabase();
    let sql =
      'SELECT * FROM links WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC';

    switch (filter) {
      case 'videos':
        sql =
          "SELECT * FROM links WHERE user_id = ? AND item_type = 'youtube' AND is_archived = 0 ORDER BY created_at DESC";
        break;
      case 'articles':
        sql =
          "SELECT * FROM links WHERE user_id = ? AND item_type = 'website' AND is_archived = 0 ORDER BY created_at DESC";
        break;
      case 'archive':
        sql =
          'SELECT * FROM links WHERE user_id = ? AND is_archived = 1 ORDER BY created_at DESC';
        break;
      case 'all':
        sql = 'SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC';
        break;
      case 'inbox':
      default:
        sql =
          'SELECT * FROM links WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC';
        break;
    }

    const stmt = database.prepare(sql);
    return stmt.all(userId) as unknown as KeepItem[];
  },

  getById(userId: string, id: string): KeepItem | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?');
    const result = stmt.get(id, userId);
    return (result as unknown as KeepItem) || null;
  },

  getByUrl(userId: string, url: string): KeepItem | null {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM links WHERE user_id = ? AND url = ?');
    const result = stmt.get(userId, url);
    return (result as unknown as KeepItem) || null;
  },

  create(input: CreateItemInput): KeepItem {
    const database = getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();

    const stmt = database.prepare(`
      INSERT INTO links (
        id, user_id, url, title, description, image_url, favicon_url, domain,
        item_type, youtube_id, is_archived, is_favorite, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.user_id,
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

    return this.getById(input.user_id, id)!;
  },

  update(userId: string, id: string, input: UpdateItemInput): KeepItem | null {
    const database = getDatabase();
    const existing = this.getById(userId, id);
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

    params.push(id, userId);
    const sql = `UPDATE links SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
    database.prepare(sql).run(...params);

    return this.getById(userId, id);
  },

  delete(userId: string, id: string): boolean {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM links WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return Number(result.changes) > 0;
  },

  clearArchive(userId: string): number {
    const database = getDatabase();
    const stmt = database.prepare(
      'DELETE FROM links WHERE user_id = ? AND is_archived = 1'
    );
    const result = stmt.run(userId);
    return Number(result.changes);
  },

  getStats(userId: string): ItemStats {
    const database = getDatabase();
    const statsQuery = database
      .prepare(
        `SELECT
          COUNT(CASE WHEN is_archived = 0 THEN 1 END) as inboxCount,
          COUNT(CASE WHEN item_type = 'youtube' AND is_archived = 0 THEN 1 END) as videosCount,
          COUNT(CASE WHEN item_type = 'website' AND is_archived = 0 THEN 1 END) as articlesCount,
          COUNT(CASE WHEN is_archived = 1 THEN 1 END) as archiveCount,
          COUNT(*) as totalCount
        FROM links
        WHERE user_id = ?`
      )
      .get(userId) as {
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
  },
};
