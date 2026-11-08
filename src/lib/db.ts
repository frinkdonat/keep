import { DatabaseSync, StatementSync } from 'node:sqlite';
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

export interface CachedUser extends UserRecord {
  sessionToken: string;
  sessionSigBuf: Buffer;
  apiKeyHashBuf: Buffer;
}

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

export function computeSessionToken(user: UserRecord): {
  token: string;
  sigBuf: Buffer;
} {
  const sigHex = crypto
    .createHmac('sha256', `keep_user_hmac:${user.password_hash}:${user.api_key}`)
    .update(`session_v2:${user.id}:${user.username}`)
    .digest('hex');
  return {
    token: `${user.id}.${sigHex}`,
    sigBuf: Buffer.from(sigHex, 'hex'),
  };
}

interface PreparedStatements {
  getAllUsersWithCounts: StatementSync;
  insertUser: StatementSync;
  updateUserPassword: StatementSync;
  updateUserApiKey: StatementSync;
  deleteUserById: StatementSync;
  deleteUserLinks: StatementSync;
  markSetupDone: StatementSync;
  countUserLinks: StatementSync;

  getLinksAll: StatementSync;
  getLinksInbox: StatementSync;
  getLinksVideos: StatementSync;
  getLinksArticles: StatementSync;
  getLinksArchive: StatementSync;
  getLinkById: StatementSync;
  getLinkByUrl: StatementSync;
  insertLink: StatementSync;
  enrichLinkMeta: StatementSync;
  updateLinkArchive: StatementSync;
  deleteLinkById: StatementSync;
  clearUserArchive: StatementSync;
  getUserStats: StatementSync;
}

interface DbContext {
  database: DatabaseSync;
  stmts: PreparedStatements;
  usersById: Map<string, CachedUser>;
  usersByUsername: Map<string, CachedUser>;
  usersByApiKey: Map<string, CachedUser>;
  userRevisions: Map<string, number>;
}

declare global {
  // eslint-disable-next-line no-var
  var __keep_db_ctx__: DbContext | undefined;
}

function rebuildUserCache(
  database: DatabaseSync,
  usersById: Map<string, CachedUser>,
  usersByUsername: Map<string, CachedUser>,
  usersByApiKey: Map<string, CachedUser>
) {
  usersById.clear();
  usersByUsername.clear();
  usersByApiKey.clear();

  const rows = database.prepare('SELECT * FROM users').all() as unknown as UserRecord[];
  for (const u of rows) {
    const { token, sigBuf } = computeSessionToken(u);
    const cached: CachedUser = {
      ...u,
      sessionToken: token,
      sessionSigBuf: sigBuf,
      apiKeyHashBuf: crypto.createHash('sha256').update(u.api_key).digest(),
    };
    usersById.set(u.id, cached);
    usersByUsername.set(u.username.toLowerCase(), cached);
    usersByApiKey.set(u.api_key, cached);
  }
}

function bumpRevision(ctx: DbContext, userId: string): void {
  const current = ctx.userRevisions.get(userId) || 1;
  ctx.userRevisions.set(userId, current + 1);
}

function getContext(): DbContext {
  if (global.__keep_db_ctx__) {
    return global.__keep_db_ctx__;
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'keep.db');
  const database = new DatabaseSync(dbPath);

  // Maximum SQLite performance tuning
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA synchronous = NORMAL;');
  database.exec('PRAGMA cache_size = -32000;'); // 32MB page cache
  database.exec('PRAGMA temp_store = MEMORY;');
  database.exec('PRAGMA mmap_size = 134217728;'); // 128MB memory-mapped I/O
  database.exec('PRAGMA busy_timeout = 5000;');

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

  const columns = database.prepare('PRAGMA table_info(links)').all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === 'user_id')) {
    database.exec("ALTER TABLE links ADD COLUMN user_id TEXT NOT NULL DEFAULT 'admin';");
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_links_user_created ON links (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_archived_created ON links (user_id, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_type_archived ON links (user_id, item_type, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_url ON links (user_id, url);
  `);

  // Sync primary admin account from environment variables
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

  // Pre-compile all hot-path SQL statements once
  const stmts: PreparedStatements = {
    getAllUsersWithCounts: database.prepare(`
      SELECT 
        u.id, u.username, u.api_key, u.role, u.setup_completed, u.created_at,
        COUNT(l.id) as item_count
      FROM users u
      LEFT JOIN links l ON l.user_id = u.id
      GROUP BY u.id
      ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at ASC
    `),
    insertUser: database.prepare(`
      INSERT INTO users (id, username, password_hash, api_key, role, setup_completed, created_at)
      VALUES (?, ?, ?, ?, 'user', 0, ?)
    `),
    updateUserPassword: database.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    updateUserApiKey: database.prepare('UPDATE users SET api_key = ? WHERE id = ?'),
    deleteUserById: database.prepare('DELETE FROM users WHERE id = ?'),
    deleteUserLinks: database.prepare('DELETE FROM links WHERE user_id = ?'),
    markSetupDone: database.prepare('UPDATE users SET setup_completed = 1 WHERE id = ?'),
    countUserLinks: database.prepare('SELECT COUNT(*) as c FROM links WHERE user_id = ?'),

    getLinksAll: database.prepare(
      'SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC'
    ),
    getLinksInbox: database.prepare(
      'SELECT * FROM links WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC'
    ),
    getLinksVideos: database.prepare(
      "SELECT * FROM links WHERE user_id = ? AND item_type = 'youtube' AND is_archived = 0 ORDER BY created_at DESC"
    ),
    getLinksArticles: database.prepare(
      "SELECT * FROM links WHERE user_id = ? AND item_type = 'website' AND is_archived = 0 ORDER BY created_at DESC"
    ),
    getLinksArchive: database.prepare(
      'SELECT * FROM links WHERE user_id = ? AND is_archived = 1 ORDER BY created_at DESC'
    ),
    getLinkById: database.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?'),
    getLinkByUrl: database.prepare('SELECT * FROM links WHERE user_id = ? AND url = ?'),
    insertLink: database.prepare(`
      INSERT INTO links (
        id, user_id, url, title, description, image_url, favicon_url, domain,
        item_type, youtube_id, is_archived, is_favorite, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `),
    enrichLinkMeta: database.prepare(`
      UPDATE links
      SET title = ?, description = ?, image_url = ?, favicon_url = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `),
    updateLinkArchive: database.prepare(`
      UPDATE links
      SET is_archived = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `),
    deleteLinkById: database.prepare('DELETE FROM links WHERE id = ? AND user_id = ?'),
    clearUserArchive: database.prepare(
      'DELETE FROM links WHERE user_id = ? AND is_archived = 1'
    ),
    getUserStats: database.prepare(`
      SELECT
        COUNT(CASE WHEN is_archived = 0 THEN 1 END) as inboxCount,
        COUNT(CASE WHEN item_type = 'youtube' AND is_archived = 0 THEN 1 END) as videosCount,
        COUNT(CASE WHEN item_type = 'website' AND is_archived = 0 THEN 1 END) as articlesCount,
        COUNT(CASE WHEN is_archived = 1 THEN 1 END) as archiveCount,
        COUNT(*) as totalCount
      FROM links
      WHERE user_id = ?
    `),
  };

  const usersById = new Map<string, CachedUser>();
  const usersByUsername = new Map<string, CachedUser>();
  const usersByApiKey = new Map<string, CachedUser>();
  const userRevisions = new Map<string, number>();
  rebuildUserCache(database, usersById, usersByUsername, usersByApiKey);

  const ctx: DbContext = {
    database,
    stmts,
    usersById,
    usersByUsername,
    usersByApiKey,
    userRevisions,
  };

  global.__keep_db_ctx__ = ctx;
  return ctx;
}

export const db = {
  // --- O(1) IN-MEMORY USER & REVISION LOOKUPS ---
  getUserById(id: string): CachedUser | null {
    return getContext().usersById.get(id) || null;
  },

  getUserByUsername(username: string): CachedUser | null {
    return getContext().usersByUsername.get(username.trim().toLowerCase()) || null;
  },

  getUserByApiKey(apiKey: string): CachedUser | null {
    return getContext().usersByApiKey.get(apiKey.trim()) || null;
  },

  getUserRevision(userId: string): number {
    return getContext().userRevisions.get(userId) || 1;
  },

  getAllUsers(): PublicUser[] {
    const { stmts } = getContext();
    const rows = stmts.getAllUsersWithCounts.all() as Array<{
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
    const ctx = getContext();
    const cleanUsername = username.trim();
    if (ctx.usersByUsername.has(cleanUsername.toLowerCase())) {
      throw new Error('Username already exists');
    }

    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const passHash = hashPassword(password);
    const now = Date.now();

    ctx.stmts.insertUser.run(id, cleanUsername, passHash, apiKey, now);
    rebuildUserCache(ctx.database, ctx.usersById, ctx.usersByUsername, ctx.usersByApiKey);

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
    const ctx = getContext();
    if (!ctx.usersById.has(id)) return null;

    if (updates.password) {
      ctx.stmts.updateUserPassword.run(hashPassword(updates.password), id);
    }

    if (updates.regenerateApiKey) {
      ctx.stmts.updateUserApiKey.run(generateApiKey(), id);
    }

    rebuildUserCache(ctx.database, ctx.usersById, ctx.usersByUsername, ctx.usersByApiKey);
    const updated = ctx.usersById.get(id)!;
    const countRow = ctx.stmts.countUserLinks.get(id) as { c: number | bigint };

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
    if (id === 'admin') return false;
    const ctx = getContext();
    ctx.stmts.deleteUserLinks.run(id);
    const result = ctx.stmts.deleteUserById.run(id);
    ctx.userRevisions.delete(id);
    rebuildUserCache(ctx.database, ctx.usersById, ctx.usersByUsername, ctx.usersByApiKey);
    return Number(result.changes) > 0;
  },

  markUserSetupCompleted(userId: string): void {
    const ctx = getContext();
    ctx.stmts.markSetupDone.run(userId);
    const u = ctx.usersById.get(userId);
    if (u) {
      u.setup_completed = 1;
    }
  },

  // --- PRE-COMPILED WORKSPACE LINK OPERATIONS ---
  getAll(userId: string, filter: FilterCategory = 'inbox'): KeepItem[] {
    const { stmts } = getContext();
    switch (filter) {
      case 'all':
        return stmts.getLinksAll.all(userId) as unknown as KeepItem[];
      case 'videos':
        return stmts.getLinksVideos.all(userId) as unknown as KeepItem[];
      case 'articles':
        return stmts.getLinksArticles.all(userId) as unknown as KeepItem[];
      case 'archive':
        return stmts.getLinksArchive.all(userId) as unknown as KeepItem[];
      case 'inbox':
      default:
        return stmts.getLinksInbox.all(userId) as unknown as KeepItem[];
    }
  },

  getById(userId: string, id: string): KeepItem | null {
    const { stmts } = getContext();
    const result = stmts.getLinkById.get(id, userId);
    return (result as unknown as KeepItem) || null;
  },

  getByUrl(userId: string, url: string): KeepItem | null {
    const { stmts } = getContext();
    const result = stmts.getLinkByUrl.get(userId, url);
    return (result as unknown as KeepItem) || null;
  },

  create(input: CreateItemInput): KeepItem {
    const ctx = getContext();
    const id = crypto.randomUUID();
    const now = Date.now();

    const item: KeepItem = {
      id,
      user_id: input.user_id,
      url: input.url,
      title: input.title || input.url,
      description: input.description || null,
      image_url: input.image_url || null,
      favicon_url: input.favicon_url || null,
      domain: input.domain || null,
      item_type: input.item_type || 'website',
      youtube_id: input.youtube_id || null,
      is_archived: 0,
      is_favorite: 0,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };

    ctx.stmts.insertLink.run(
      item.id,
      item.user_id,
      item.url,
      item.title,
      item.description,
      item.image_url,
      item.favicon_url,
      item.domain,
      item.item_type,
      item.youtube_id,
      item.notes,
      item.created_at,
      item.updated_at
    );

    bumpRevision(ctx, input.user_id);
    return item;
  },

  enrichMetadata(
    userId: string,
    id: string,
    meta: {
      title: string;
      description: string | null;
      image_url: string | null;
      favicon_url: string | null;
    }
  ): void {
    const ctx = getContext();
    ctx.stmts.enrichLinkMeta.run(
      meta.title,
      meta.description,
      meta.image_url,
      meta.favicon_url,
      Date.now(),
      id,
      userId
    );
    bumpRevision(ctx, userId);
  },

  update(userId: string, id: string, input: UpdateItemInput): KeepItem | null {
    const ctx = getContext();

    // Fast path for the most frequent operation: toggling archive status
    if (
      input.is_archived !== undefined &&
      input.title === undefined &&
      input.description === undefined &&
      input.notes === undefined
    ) {
      const now = Date.now();
      const archivedVal = input.is_archived ? 1 : 0;
      const res = ctx.stmts.updateLinkArchive.run(archivedVal, now, id, userId);
      if (Number(res.changes) === 0) return null;
      bumpRevision(ctx, userId);
      return this.getById(userId, id);
    }

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
    ctx.database.prepare(sql).run(...params);
    bumpRevision(ctx, userId);

    return this.getById(userId, id);
  },

  delete(userId: string, id: string): boolean {
    const ctx = getContext();
    const result = ctx.stmts.deleteLinkById.run(id, userId);
    const changed = Number(result.changes) > 0;
    if (changed) bumpRevision(ctx, userId);
    return changed;
  },

  clearArchive(userId: string): number {
    const ctx = getContext();
    const result = ctx.stmts.clearUserArchive.run(userId);
    const count = Number(result.changes) > 0 ? Number(result.changes) : 0;
    if (count > 0) bumpRevision(ctx, userId);
    return count;
  },

  getStats(userId: string): ItemStats {
    const { stmts } = getContext();
    const statsQuery = stmts.getUserStats.get(userId) as {
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
