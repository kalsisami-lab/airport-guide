import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// Lazy singleton — DB is opened on first query, not at module evaluation.
// This prevents better-sqlite3 from attempting to acquire file locks during
// Next.js's build-time "Collecting page data" phase, where the Vercel build
// filesystem does not support POSIX file locking (SQLITE_IOERR_LOCK).
let _db: DrizzleDB | null = null;

function openDb(): DrizzleDB {
  if (_db) return _db;
  const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');
  const isVercel = !!process.env.VERCEL;
  const sqlite = new Database(DB_PATH, {
    readonly:      isVercel,
    fileMustExist: true,
  });
  // WAL mode is intentionally avoided: the .sqlite file is committed to git and
  // deployed to Vercel's read-only /var/task. WAL readers require a .shm file;
  // if it can't be created, SQLite throws SQLITE_CANTOPEN. DELETE journal mode
  // (the SQLite default) is self-contained and works on read-only filesystems.
  sqlite.pragma('foreign_keys = ON');
  _db = drizzle(sqlite, { schema });
  return _db;
}

export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    return Reflect.get(openDb(), prop, receiver);
  },
});

export type DB = DrizzleDB;
