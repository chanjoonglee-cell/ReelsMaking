#!/usr/bin/env tsx
// CLI: scrapes a Threads profile and prints the result as JSON to stdout.
//
// Usage:
//   npx tsx scripts/scrape.ts --handle marketing_kim
//   npx tsx scripts/scrape.ts --handle marketing_kim --posts 5 --comments 20
//   npx tsx scripts/scrape.ts --handle marketing_kim --save        # writes data/{handle}.json
//   npx tsx scripts/scrape.ts --handle marketing_kim --headful     # show browser (login etc.)
//
// Env:
//   THREADS_USER_DATA_DIR  persistent browser profile (default ./.threads-session)

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { scrapeAccount } from '../src/scraper/scrape';

type Args = {
  handle: string;
  posts: number;
  comments: number;
  save: boolean;
  headful: boolean;
  userDataDir: string;
};

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--handle') out.handle = (next() ?? '').replace(/^@/, '');
    else if (a === '--posts') out.posts = parseInt(next() ?? '10', 10);
    else if (a === '--comments') out.comments = parseInt(next() ?? '20', 10);
    else if (a === '--save') out.save = true;
    else if (a === '--headful') out.headful = true;
    else if (a === '--user-data-dir') out.userDataDir = next();
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      process.stderr.write(`unknown argument: ${a}\n`);
      printHelp();
      process.exit(2);
    }
  }

  if (!out.handle) {
    process.stderr.write('error: --handle is required\n');
    printHelp();
    process.exit(2);
  }

  return {
    handle: out.handle,
    posts: out.posts ?? 10,
    comments: out.comments ?? 20,
    save: out.save ?? false,
    headful: out.headful ?? false,
    userDataDir:
      out.userDataDir ??
      process.env.THREADS_USER_DATA_DIR ??
      resolve(process.cwd(), '.threads-session'),
  };
}

function printHelp() {
  process.stderr.write(
    [
      'Usage: tsx scripts/scrape.ts --handle <handle> [options]',
      '',
      'Options:',
      '  --handle <handle>       Threads handle, with or without leading @ (required)',
      '  --posts <n>             Posts to collect (default 10)',
      '  --comments <n>          Comments per post (default 20)',
      '  --save                  Also write data/<handle>.json',
      '  --headful               Run browser visible (use for first-time login)',
      '  --user-data-dir <path>  Override THREADS_USER_DATA_DIR',
      '',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.stderr.write(
    `[scrape] handle=${args.handle} posts=${args.posts} comments=${args.comments} headful=${args.headful}\n`,
  );

  const account = await scrapeAccount({
    handle: args.handle,
    postsLimit: args.posts,
    commentsLimit: args.comments,
    userDataDir: args.userDataDir,
    headless: !args.headful,
  });

  const json = JSON.stringify(account, null, 2);
  process.stdout.write(`${json}\n`);

  if (args.save) {
    const out = resolve(process.cwd(), 'data', `${args.handle}.json`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, json, 'utf8');
    process.stderr.write(`[scrape] saved → ${out}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[scrape] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
