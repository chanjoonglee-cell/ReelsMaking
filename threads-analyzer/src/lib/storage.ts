import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Account } from '../types';

const DATA_DIR = resolve(process.cwd(), 'data');

// Threads handles only contain alnum / underscore / period. Reject everything
// else outright so the filename can never escape the data dir.
function safeHandle(handle: string): string {
  if (!/^[A-Za-z0-9_.]{1,64}$/.test(handle)) {
    throw new Error(`unsafe handle: ${handle}`);
  }
  return handle;
}

function pathFor(handle: string): string {
  return resolve(DATA_DIR, `${safeHandle(handle)}.json`);
}

export async function saveAccount(account: Account): Promise<string> {
  await mkdir(DATA_DIR, { recursive: true });
  const path = pathFor(account.handle);
  await writeFile(path, JSON.stringify(account, null, 2), 'utf8');
  return path;
}

export async function loadAccount(handle: string): Promise<Account | null> {
  try {
    const raw = await readFile(pathFor(handle), 'utf8');
    return JSON.parse(raw) as Account;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export type CachedEntry = {
  handle: string;
  scrapedAt: string;
  size: number;
};

export async function listCached(): Promise<CachedEntry[]> {
  let files: string[];
  try {
    files = await readdir(DATA_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (f): Promise<CachedEntry | null> => {
        const handle = f.slice(0, -'.json'.length);
        try {
          safeHandle(handle);
        } catch {
          return null;
        }
        try {
          const path = resolve(DATA_DIR, f);
          const [s, account] = await Promise.all([
            stat(path),
            loadAccount(handle),
          ]);
          return {
            handle,
            scrapedAt: account?.scrapedAt ?? s.mtime.toISOString(),
            size: s.size,
          };
        } catch {
          return null;
        }
      }),
  );

  return entries
    .filter((e): e is CachedEntry => e !== null)
    .sort((a, b) => b.scrapedAt.localeCompare(a.scrapedAt));
}
