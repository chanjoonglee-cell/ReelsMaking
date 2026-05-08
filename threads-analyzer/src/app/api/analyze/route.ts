import { NextRequest } from 'next/server';
import { resolve } from 'node:path';
import { scrapeAccount, type ScrapeProgress } from '@/scraper/scrape';
import {
  analyzePostsParallel,
  synthesizeAccount,
  DEFAULT_MODEL,
  type AnalyzeProgress,
  type AnalyzerModel,
} from '@/analyzer/analyze';
import { saveAccount } from '@/lib/storage';
import { formatSse, type ProgressData } from '@/lib/sse';

// Playwright + Anthropic SDK both require Node.js — never let Next.js try Edge.
export const runtime = 'nodejs';
// Local-only tool; bump for hosted deploys (Vercel free=10s, pro=60s, enterprise=300s).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const VALID_MODELS: AnalyzerModel[] = ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-7'];
const HANDLE_RE = /^[A-Za-z0-9_.]{1,64}$/;

type Body = {
  handle?: string;
  posts?: number;
  comments?: number;
  model?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  const handle = (body.handle ?? '').trim().replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) {
    return Response.json({ error: 'invalid handle' }, { status: 400 });
  }

  const postsLimit = clampInt(body.posts, 1, 20, 10);
  const commentsLimit = clampInt(body.comments, 0, 50, 20);
  const model: AnalyzerModel = VALID_MODELS.includes(body.model as AnalyzerModel)
    ? (body.model as AnalyzerModel)
    : DEFAULT_MODEL;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not set on the server' },
      { status: 500 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = req.signal;
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(formatSse(event, data));
        } catch {
          closed = true;
        }
      };
      const progress = (data: ProgressData) => send('progress', data);
      const checkAborted = () => {
        if (signal.aborted) throw new Error('aborted');
      };

      // Mirror client disconnects onto our local closed flag so we can short
      // circuit further scraping / Claude calls instead of writing to a dead
      // stream. Playwright won't be interrupted mid-call but won't queue the
      // next post either.
      signal.addEventListener('abort', () => {
        closed = true;
      });

      try {
        progress({ stage: 'scraping', message: '브라우저 세션 시작 중…' });

        const account = await scrapeAccount({
          handle,
          postsLimit,
          commentsLimit,
          userDataDir:
            process.env.THREADS_USER_DATA_DIR ??
            resolve(process.cwd(), '.threads-session'),
          headless: true,
          onProgress: forwardScrapeProgress(progress),
        });
        checkAborted();

        if (account.posts.length === 0) {
          send('error', {
            message:
              '게시물을 한 개도 가져오지 못함. 로그인 세션이 살아있는지, 핸들이 올바른지 확인해 줘.',
          });
          send('done', { handle, savedTo: null });
          controller.close();
          return;
        }

        progress({
          stage: 'analyzing',
          message: `Claude (${model}) 병렬 분석 시작 — 게시물 ${account.posts.length}개`,
          index: 0,
          total: account.posts.length,
        });

        await analyzePostsParallel(
          account,
          model,
          forwardAnalyzeProgress(progress),
          signal,
        );
        checkAborted();

        const analyzedCount = account.posts.filter((p) => p.analysis).length;
        if (analyzedCount > 0) {
          progress({ stage: 'analyzing', message: '계정 종합 인사이트 합성 중…' });
          try {
            account.summary = await synthesizeAccount(account, model, signal);
          } catch (err) {
            send('error', {
              message: `종합 분석 실패 (게시물별 결과는 정상): ${(err as Error).message}`,
            });
          }
          checkAborted();
        }

        progress({ stage: 'saving', message: 'data/ 폴더에 결과 저장 중' });
        let savedTo: string | null = null;
        try {
          savedTo = await saveAccount(account);
        } catch (err) {
          send('error', {
            message: `저장 실패: ${(err as Error).message} (분석 결과는 그대로 반환)`,
          });
        }

        send('account', account);
        send('done', { handle, savedTo });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'aborted' || signal.aborted) {
          // Client cancelled. No need to push more events; the connection is gone.
        } else {
          send('error', { message: msg });
          send('done', { handle, savedTo: null });
        }
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Hint for nginx-style buffering proxies.
      'X-Accel-Buffering': 'no',
    },
  });
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function forwardScrapeProgress(progress: (p: ProgressData) => void) {
  return (p: ScrapeProgress) => {
    if (p.stage === 'profile') {
      progress({ stage: 'scraping', message: p.message });
    } else if (p.stage === 'feed') {
      progress({
        stage: 'scraping',
        message: p.message,
        index: p.collected,
        total: p.target,
      });
    } else {
      progress({
        stage: 'scraping',
        message: p.message,
        index: p.index,
        total: p.total,
      });
    }
  };
}

function forwardAnalyzeProgress(progress: (p: ProgressData) => void) {
  return (p: AnalyzeProgress) => {
    if (p.type === 'start') {
      progress({
        stage: 'analyzing',
        message: 'AI 분석 호출 중…',
        index: 0,
        total: p.total,
      });
    } else if (p.type === 'done') {
      progress({
        stage: 'analyzing',
        message: `분석 완료 ${p.index}/${p.total}`,
        index: p.index,
        total: p.total,
      });
    } else {
      progress({
        stage: 'analyzing',
        message: `게시물 ${p.index} 분석 실패: ${p.message}`,
        index: p.index,
        total: p.total,
      });
    }
  };
}
