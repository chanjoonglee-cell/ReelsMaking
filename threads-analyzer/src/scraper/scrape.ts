import { chromium, type BrowserContext, type Page } from 'playwright';
import { SELECTORS } from './selectors';
import type { Account, Post, Comment } from '../types';

const THREADS_BASE = 'https://www.threads.net';

export type ScrapeProgress =
  | { stage: 'profile'; message: string }
  | { stage: 'feed'; message: string; collected: number; target: number }
  | { stage: 'post'; message: string; index: number; total: number };

export type ScrapeOptions = {
  handle: string;
  postsLimit: number;
  commentsLimit: number;
  userDataDir: string;
  headless: boolean;
  onProgress?: (p: ScrapeProgress) => void;
};

// Stderr is the universal sink (CLI + dev console); structured progress events
// are also delivered to the optional onProgress callback for SSE consumers.
const log = (msg: string) => process.stderr.write(`[scrape] ${msg}\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randSleep = (minMs: number, maxMs: number) =>
  sleep(minMs + Math.random() * (maxMs - minMs));

// "12.3K" / "1,234" / "1.2M" → number
function parseCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = raw.trim().replace(/,/g, '');
  const m = s.match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const suffix = (m[2] ?? '').toUpperCase();
  const mult = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1;
  return Math.round(n * mult);
}

function postIdFromUrl(url: string): string {
  // https://www.threads.net/@handle/post/abc123  → abc123
  const m = url.match(/\/post\/([^/?#]+)/);
  return m ? m[1] : url;
}

async function firstMatching(page: Page, selectors: readonly string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) === 0) continue;
      const text = (await el.innerText({ timeout: 1500 })).trim();
      if (text) return text;
    } catch {
      // try next
    }
  }
  return null;
}

async function scrapeProfile(page: Page, handle: string) {
  const url = `${THREADS_BASE}/@${handle}`;
  log(`profile: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const displayName = (await firstMatching(page, SELECTORS.profile.displayName)) ?? handle;
  const bio = (await firstMatching(page, SELECTORS.profile.bio)) ?? '';

  let followers = 0;
  for (const sel of SELECTORS.profile.followersAnchor) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) === 0) continue;
      const text = (await el.innerText({ timeout: 1500 })).trim();
      const n = parseCount(text);
      if (n > 0) {
        followers = n;
        break;
      }
    } catch {}
  }

  return { displayName, bio, followers };
}

async function collectPostUrls(page: Page, handle: string, limit: number): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  let lastHeight = 0;
  let stagnantRounds = 0;

  while (ordered.length < limit && stagnantRounds < 4) {
    // Pull all permalink-shaped anchors currently in the DOM.
    const anchors = await page.locator('a[href*="/post/"]').evaluateAll((els) =>
      (els as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean),
    );
    for (const href of anchors) {
      // Only keep posts that belong to the handle being analyzed.
      if (!href.includes(`/@${handle}/`)) continue;
      const normalized = href.split('?')[0];
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
        if (ordered.length >= limit) break;
      }
    }

    if (ordered.length >= limit) break;

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await sleep(900 + Math.random() * 600);

    const newHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (newHeight === lastHeight && newHeight === height) stagnantRounds += 1;
    else stagnantRounds = 0;
    lastHeight = newHeight;
  }

  return ordered.slice(0, limit);
}

async function scrapePostDetail(
  page: Page,
  postUrl: string,
  commentsLimit: number,
): Promise<Post> {
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});

  // Body text: pick the longest dir="auto" block on the article — typically the post itself.
  const bodyTexts = await page
    .locator('article div[dir="auto"]')
    .allInnerTexts()
    .catch(() => [] as string[]);
  const content = bodyTexts.sort((a, b) => b.length - a.length)[0]?.trim() ?? '';

  // Engagement: read aria-labels on like / reply buttons. Threads exposes counts there.
  const likeLabel = await page
    .locator('div[role="button"][aria-label*="Like"], div[role="button"][aria-label*="like"]')
    .first()
    .getAttribute('aria-label')
    .catch(() => null);
  const replyLabel = await page
    .locator('div[role="button"][aria-label*="Repl"], div[role="button"][aria-label*="repl"]')
    .first()
    .getAttribute('aria-label')
    .catch(() => null);

  const likes = parseCount(likeLabel ?? '');
  const replies = parseCount(replyLabel ?? '');

  // Comments: each "comment" is another pressable container under the post. The first
  // such container is the post itself, so skip it.
  const containerLocator = page.locator('div[data-pressable-container="true"]');
  const totalContainers = await containerLocator.count().catch(() => 0);
  const comments: Comment[] = [];
  for (let i = 1; i < totalContainers && comments.length < commentsLimit; i += 1) {
    const item = containerLocator.nth(i);
    const author =
      (await item
        .locator('a[href^="/@"]')
        .first()
        .innerText()
        .catch(() => null)) ?? '';
    const textParts = await item
      .locator('div[dir="auto"], span[dir="auto"]')
      .allInnerTexts()
      .catch(() => [] as string[]);
    const text = textParts.join(' ').trim();
    if (!text) continue;
    comments.push({ author: author.replace(/^@/, '').trim(), text });
  }

  // postedAt: <time> element on the post. Best-effort.
  const postedAt =
    (await page
      .locator('time')
      .first()
      .getAttribute('datetime')
      .catch(() => null)) ?? '';

  return {
    id: postIdFromUrl(postUrl),
    url: postUrl,
    content,
    postedAt,
    likes,
    replies,
    comments,
  };
}

export async function scrapeAccount(opts: ScrapeOptions): Promise<Account> {
  const context: BrowserContext = await chromium.launchPersistentContext(opts.userDataDir, {
    headless: opts.headless,
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  });

  const emit = opts.onProgress ?? (() => {});

  try {
    const page = await context.newPage();
    emit({ stage: 'profile', message: `프로필 가져오는 중 @${opts.handle}` });
    const profile = await scrapeProfile(page, opts.handle);
    log(`profile: ${profile.displayName} · ${profile.followers} followers`);

    emit({
      stage: 'feed',
      message: `게시물 목록 수집 중 (목표 ${opts.postsLimit}개)`,
      collected: 0,
      target: opts.postsLimit,
    });
    const postUrls = await collectPostUrls(page, opts.handle, opts.postsLimit);
    log(`found ${postUrls.length}/${opts.postsLimit} post urls`);
    emit({
      stage: 'feed',
      message: `게시물 ${postUrls.length}개 발견`,
      collected: postUrls.length,
      target: opts.postsLimit,
    });

    const posts: Post[] = [];
    for (let i = 0; i < postUrls.length; i += 1) {
      const url = postUrls[i];
      log(`post ${i + 1}/${postUrls.length}: ${url}`);
      emit({
        stage: 'post',
        message: `게시물 ${i + 1}/${postUrls.length} 수집 중`,
        index: i + 1,
        total: postUrls.length,
      });
      try {
        const post = await scrapePostDetail(page, url, opts.commentsLimit);
        posts.push(post);
      } catch (err) {
        log(`  failed: ${(err as Error).message}`);
      }
      // Per PRD §6 — randomized 2–4s pause between posts to reduce ban risk.
      if (i < postUrls.length - 1) await randSleep(2000, 4000);
    }

    return {
      handle: opts.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      followers: profile.followers,
      scrapedAt: new Date().toISOString(),
      posts,
    };
  } finally {
    await context.close();
  }
}
