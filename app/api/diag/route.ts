import { NextResponse } from 'next/server';
import { readdirSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  const info: Record<string, unknown> = {
    cwd,
    nodeVersion: process.version,
    platform: process.platform,
  };

  try {
    info.filesAtCwd = readdirSync(cwd);
  } catch (e) {
    info.cwdError = String(e);
  }

  const dbDir = path.join(cwd, 'db');
  info.dbDirPath = dbDir;
  info.dbDirExists = existsSync(dbDir);
  if (existsSync(dbDir)) {
    try {
      info.filesInDb = readdirSync(dbDir);
    } catch (e) {
      info.dbReadError = String(e);
    }
  }

  // Tarkista myös task-hakemisto (Vercel-spesifinen polku)
  const taskPath = '/var/task';
  info.taskExists = existsSync(taskPath);
  if (existsSync(taskPath)) {
    try {
      info.filesInTask = readdirSync(taskPath);
      const taskDb = path.join(taskPath, 'db');
      if (existsSync(taskDb)) {
        info.filesInTaskDb = readdirSync(taskDb);
      }
    } catch (e) {
      info.taskReadError = String(e);
    }
  }

  return NextResponse.json(info, { status: 200 });
}
