import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'entitlements.sqlite');

const isVercel = !!process.env.VERCEL;
const sqlite = new Database(DB_PATH, {
  readonly:      isVercel,
  fileMustExist: true,
});
if (!isVercel) {
  sqlite.pragma('journal_mode = WAL');
} else {
  sqlite.pragma('journal_mode = MEMORY');
}
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
