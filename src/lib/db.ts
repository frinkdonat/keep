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

export function hashPasswordSync(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function hashPasswordAsync(password: string, existingSalt?: string): Promise<string> {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPasswordSync(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

/**
 * Asynchronous password verification on libuv worker pool so login attempts
 * never block the main Node.js event loop thread.
 */
export function verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return Promise.resolve(false);
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err || derived.length !== keyBuf.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(derived, keyBuf));
    });
  });
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

const LINK_COLUMNS = `
  id, user_id, url, title, image_url, favicon_url, domain,
  item_type, youtube_id, is_archived, created_at, updated_at
`;

interface PreparedStatements {
  getAllUsersWithCounts: StatementSync;
  insertUser: StatementSync;
  updateUserPassword: StatementSync;
  updateUserApiKey: StatementSync;
  deleteUserById: StatementSync;
  deleteUserLinks: StatementSync;
  countUserLinks: StatementSync;

  getLinksAll: StatementSync;
  getLinksInbox: StatementSync;
  getLinksArchive: StatementSync;
  getLinkById: StatementSync;
  getLinkByUrl: StatementSync;
  insertLink: StatementSync;
  updateLinkArchive: StatementSync;
  deleteLinkById: StatementSync;
  clearUserArchive: StatementSync;
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

/**
 * Converts a node:sqlite row into a plain JS object for React Server Components
 * and deterministically guarantees a working Google S2 favicon and YouTube hqdefault thumbnail.
 */
function toPlainItem(row: unknown): KeepItem {
  const r = row as KeepItem;
  const domain = r.domain ? String(r.domain).replace(/^www\./, '') : null;
  const youtubeId = r.youtube_id ? String(r.youtube_id) : null;

  let imageUrl = r.image_url ? String(r.image_url) : null;
  if (youtubeId) {
    if (!imageUrl || imageUrl.includes('/maxresdefault.jpg')) {
      imageUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    }
  }

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
    : null;

  return {
    id: String(r.id),
    user_id: String(r.user_id),
    url: String(r.url),
    title: String(r.title || r.url),
    image_url: imageUrl,
    favicon_url: faviconUrl,
    domain,
    item_type: r.item_type === 'youtube' ? 'youtube' : 'website',
    youtube_id: youtubeId,
    is_archived: Number(r.is_archived) === 1 ? 1 : 0,
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  };
}

function getContext(): DbContext {
  if (global.__keep_db_ctx__) {
    return global.__keep_db_ctx__;
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  }

  const dbPath = path.join(dataDir, 'keep.db');
  const database = new DatabaseSync(dbPath);

  // SQLite WAL performance configuration (zero maintenance required)
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA synchronous = NORMAL;');
  database.exec('PRAGMA cache_size = -16000;'); // 16MB page cache
  database.exec('PRAGMA temp_store = MEMORY;');
  database.exec('PRAGMA busy_timeout = 5000;');

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'admin',
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      image_url TEXT,
      favicon_url TEXT,
      domain TEXT,
      item_type TEXT DEFAULT 'website',
      youtube_id TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_user_created ON links (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_archived_created ON links (user_id, is_archived, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_links_user_url ON links (user_id, url);
  `);

  // Sync primary admin account from environment variables
  const envAdmin = getEnvAdminConfig();
  const existingAdmin = database
    .prepare("SELECT * FROM users WHERE id = 'admin'")
    .get() as unknown as UserRecord | undefined;

  if (!existingAdmin) {
    database
      .prepare(
        `INSERT INTO users (id, username, password_hash, api_key, role, created_at)
         VALUES ('admin', ?, ?, ?, 'admin', ?)`
      )
      .run(
        envAdmin.username,
        hashPasswordSync(envAdmin.password),
        envAdmin.apiKey,
        Date.now()
      );
  } else {
    const usernameChanged = existingAdmin.username !== envAdmin.username;
    const apiKeyChanged = existingAdmin.api_key !== envAdmin.apiKey;
    const passwordChanged = !verifyPasswordSync(envAdmin.password, existingAdmin.password_hash);

    if (usernameChanged || apiKeyChanged || passwordChanged) {
      database
        .prepare(
          `UPDATE users SET username = ?, password_hash = ?, api_key = ? WHERE id = 'admin'`
        )
        .run(
          envAdmin.username,
          passwordChanged ? hashPasswordSync(envAdmin.password) : existingAdmin.password_hash,
          envAdmin.apiKey
        );
    }
  }

  const stmts: PreparedStatements = {
    getAllUsersWithCounts: database.prepare(`
      SELECT 
        u.id, u.username, u.api_key, u.role, u.created_at,
        COUNT(l.id) as item_count
      FROM users u
      LEFT JOIN links l ON l.user_id = u.id
      GROUP BY u.id
      ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at ASC
    `),
    insertUser: database.prepare(`
      INSERT INTO users (id, username, password_hash, api_key, role, created_at)
      VALUES (?, ?, ?, ?, 'user', ?)
    `),
    updateUserPassword: database.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    updateUserApiKey: database.prepare('UPDATE users SET api_key = ? WHERE id = ?'),
    deleteUserById: database.prepare('DELETE FROM users WHERE id = ?'),
    deleteUserLinks: database.prepare('DELETE FROM links WHERE user_id = ?'),
    countUserLinks: database.prepare('SELECT COUNT(*) as c FROM links WHERE user_id = ?'),

    getLinksAll: database.prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? ORDER BY created_at DESC`
    ),
    getLinksInbox: database.prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC`
    ),
    getLinksArchive: database.prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? AND is_archived = 1 ORDER BY created_at DESC`
    ),
    getLinkById: database.prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE id = ? AND user_id = ?`
    ),
    getLinkByUrl: database.prepare(
      `SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? AND url = ?`
    ),
    insertLink: database.prepare(`
      INSERT INTO links (
        id, user_id, url, title, image_url, favicon_url, domain,
        item_type, youtube_id, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
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
      created_at: number;
      item_count: number | bigint;
    }>;

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      api_key: r.api_key,
      role: r.role,
      item_count: Number(r.item_count),
      created_at: r.created_at,
    }));
  },

  async createUser(username: string, password: string): Promise<PublicUser> {
    const ctx = getContext();
    const cleanUsername = username.trim();
    if (ctx.usersByUsername.has(cleanUsername.toLowerCase())) {
      throw new Error('Username already exists');
    }

    const id = crypto.randomUUID();
    const apiKey = generateApiKey();
    const passHash = await hashPasswordAsync(password);
    const now = Date.now();

    ctx.stmts.insertUser.run(id, cleanUsername, passHash, apiKey, now);
    rebuildUserCache(ctx.database, ctx.usersById, ctx.usersByUsername, ctx.usersByApiKey);

    return {
      id,
      username: cleanUsername,
      api_key: apiKey,
      role: 'user',
      item_count: 0,
      created_at: now,
    };
  },

  async updateUser(
    id: string,
    updates: { password?: string; regenerateApiKey?: boolean }
  ): Promise<PublicUser | null> {
    const ctx = getContext();
    if (!ctx.usersById.has(id)) return null;

    if (updates.password) {
      const passHash = await hashPasswordAsync(updates.password);
      ctx.stmts.updateUserPassword.run(passHash, id);
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

  getAll(userId: string, filter: FilterCategory = 'inbox'): KeepItem[] {
    const { stmts } = getContext();
    let rows: unknown[];
    switch (filter) {
      case 'all':
        rows = stmts.getLinksAll.all(userId);
        break;
      case 'archive':
        rows = stmts.getLinksArchive.all(userId);
        break;
      case 'inbox':
      default:
        rows = stmts.getLinksInbox.all(userId);
        break;
    }
    return rows.map(toPlainItem);
  },

  getById(userId: string, id: string): KeepItem | null {
    const { stmts } = getContext();
    const result = stmts.getLinkById.get(id, userId);
    return result ? toPlainItem(result) : null;
  },

  getByUrl(userId: string, url: string): KeepItem | null {
    const { stmts } = getContext();
    const result = stmts.getLinkByUrl.get(userId, url);
    return result ? toPlainItem(result) : null;
  },

  create(input: CreateItemInput): KeepItem {
    const ctx = getContext();
    const id = crypto.randomUUID();
    const now = Date.now();

    const rawRow = {
      id,
      user_id: input.user_id,
      url: input.url,
      title: input.title || input.url,
      image_url: input.image_url || null,
      favicon_url: input.favicon_url || null,
      domain: input.domain || null,
      item_type: input.item_type || 'website',
      youtube_id: input.youtube_id || null,
      is_archived: 0,
      created_at: now,
      updated_at: now,
    };

    ctx.stmts.insertLink.run(
      rawRow.id,
      rawRow.user_id,
      rawRow.url,
      rawRow.title,
      rawRow.image_url,
      rawRow.favicon_url,
      rawRow.domain,
      rawRow.item_type,
      rawRow.youtube_id,
      rawRow.created_at,
      rawRow.updated_at
    );

    bumpRevision(ctx, input.user_id);
    return toPlainItem(rawRow);
  },

  update(userId: string, id: string, input: UpdateItemInput): KeepItem | null {
    const ctx = getContext();
    const now = Date.now();
    const archivedVal = input.is_archived ? 1 : 0;
    const res = ctx.stmts.updateLinkArchive.run(archivedVal, now, id, userId);
    if (Number(res.changes) === 0) return null;
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
};
