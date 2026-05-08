'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Post, Analysis, AccountSummary } from '@/types';

type Stage = 'idle' | 'running' | 'done' | 'error';
type CachedEntry = { handle: string; scrapedAt: string; size: number };

type ProgressFrame = {
  stage: 'scraping' | 'analyzing' | 'saving';
  message: string;
  index?: number;
  total?: number;
};

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (기본 — 균형)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini (속도/비용 우선)' },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
  const [handle, setHandle] = useState('');
  const [postsCount, setPostsCount] = useState<5 | 10 | 20>(10);
  const [model, setModel] = useState<string>('gpt-4o');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [latestProgress, setLatestProgress] = useState<ProgressFrame | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [cached, setCached] = useState<CachedEntry[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const abortRef = useRef<AbortController | null>(null);

  // refresh recent-list whenever we land on idle/done
  useEffect(() => {
    if (stage === 'idle' || stage === 'done') {
      void fetch('/api/cached')
        .then((r) => r.json())
        .then((data) => setCached(data.entries ?? []))
        .catch(() => {});
    }
  }, [stage]);

  // tick-tock for the elapsed-seconds display while running
  useEffect(() => {
    if (stage !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [stage]);

  const elapsed = useMemo(() => {
    if (startedAt == null) return 0;
    return Math.max(0, Math.floor(((stage === 'running' ? now : startedAt) - startedAt) / 1000));
  }, [now, startedAt, stage]);

  async function start(handleOverride?: string) {
    const cleanHandle = (handleOverride ?? handle).trim().replace(/^@/, '');
    if (!cleanHandle) {
      setError('핸들을 입력해 줘');
      setStage('error');
      return;
    }
    if (handleOverride && handleOverride !== handle) setHandle(cleanHandle);

    abortRef.current = new AbortController();
    setStage('running');
    setProgressLog([`▸ 분석 시작: @${cleanHandle} · 게시물 ${postsCount}개 · ${model}`]);
    setLatestProgress(null);
    setAccount(null);
    setError(null);
    setSavedTo(null);
    setStartedAt(Date.now());
    let sawError = false;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: cleanHandle,
          posts: postsCount,
          comments: 20,
          model,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`서버 오류: ${errText}`);
      }

      await consumeSse(res.body, {
        onProgress: (frame) => {
          setLatestProgress(frame);
          setProgressLog((prev) => [...prev, `▸ ${frame.message}`]);
        },
        onAccount: (acc) => setAccount(acc),
        onError: (msg) => {
          sawError = true;
          setError(msg);
        },
        onDone: ({ savedTo: s }) => setSavedTo(s),
      });

      setStage(sawError ? 'error' : 'done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setProgressLog((prev) => [...prev, '▸ 사용자가 취소함']);
        setStage('idle');
      } else {
        setError((err as Error).message);
        setStage('error');
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  async function loadCached(h: string) {
    setError(null);
    try {
      const res = await fetch(`/api/cached?handle=${encodeURIComponent(h)}`);
      if (!res.ok) throw new Error(await res.text());
      const acc: Account = await res.json();
      setAccount(acc);
      setHandle(h);
      setProgressLog([`▸ 캐시에서 로드: @${h} (${new Date(acc.scrapedAt).toLocaleString('ko-KR')})`]);
      setStage('done');
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  }

  function reset() {
    setStage('idle');
    setProgressLog([]);
    setAccount(null);
    setError(null);
    setSavedTo(null);
    setStartedAt(null);
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Threads Analyzer</h1>
        <p className="text-neutral-400 mt-1 text-sm">
          핸들 → 게시물 자동 수집 → GPT 분석 → 마케터 인사이트
        </p>
      </header>

      {stage === 'idle' && (
        <InputForm
          handle={handle}
          setHandle={setHandle}
          postsCount={postsCount}
          setPostsCount={setPostsCount}
          model={model}
          setModel={setModel}
          onSubmit={start}
          cached={cached}
          onLoadCached={loadCached}
        />
      )}

      {stage === 'running' && (
        <ProgressView
          log={progressLog}
          elapsed={elapsed}
          progress={latestProgress}
          onCancel={cancel}
        />
      )}

      {(stage === 'done' || stage === 'error') && account && (
        <ResultsView
          account={account}
          savedTo={savedTo}
          elapsed={elapsed}
          partialError={stage === 'error' ? error : null}
          onReset={reset}
          onReanalyze={() => start(account.handle)}
        />
      )}

      {stage === 'error' && !account && (
        <div className="border border-red-500/40 bg-red-950/20 rounded-lg p-4">
          <p className="text-red-300 font-semibold">오류</p>
          <p className="text-sm text-neutral-300 mt-1 whitespace-pre-wrap">{error}</p>
          <button
            onClick={reset}
            className="mt-3 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
          >
            돌아가기
          </button>
        </div>
      )}
    </main>
  );
}

function InputForm(props: {
  handle: string;
  setHandle: (v: string) => void;
  postsCount: 5 | 10 | 20;
  setPostsCount: (v: 5 | 10 | 20) => void;
  model: string;
  setModel: (v: string) => void;
  onSubmit: () => void;
  cached: CachedEntry[];
  onLoadCached: (h: string) => void;
}) {
  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
        className="border border-neutral-800 rounded-xl p-6 bg-neutral-900/40 space-y-5"
      >
        <div>
          <label className="text-sm text-neutral-400 block mb-1.5">Threads 핸들</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-neutral-700 bg-neutral-800 text-neutral-400">
              @
            </span>
            <input
              autoFocus
              value={props.handle}
              onChange={(e) => props.setHandle(e.target.value)}
              placeholder="marketing_kim"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-r px-3 py-2 outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-neutral-400 block mb-1.5">게시물 수</label>
            <div className="flex gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => props.setPostsCount(n)}
                  className={`flex-1 py-2 rounded border ${
                    props.postsCount === n
                      ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                      : 'border-neutral-700 hover:border-neutral-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-neutral-400 block mb-1.5">분석 모델</label>
            <select
              value={props.model}
              onChange={(e) => props.setModel(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 outline-none focus:border-neutral-500"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded bg-blue-600 hover:bg-blue-500 font-semibold transition"
        >
          분석 시작
        </button>

        <p className="text-xs text-neutral-500">
          최초 1회 헤드풀 모드로 부계정 로그인이 필요해 (README 참고).
          댓글은 게시물당 최대 20개 수집.
        </p>
      </form>

      {props.cached.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 mb-2">최근 분석</h2>
          <div className="grid gap-2">
            {props.cached.slice(0, 8).map((c) => (
              <button
                key={c.handle}
                onClick={() => props.onLoadCached(c.handle)}
                className="text-left border border-neutral-800 hover:border-neutral-600 rounded-lg px-4 py-3 bg-neutral-900/30 transition"
              >
                <div className="flex justify-between items-center">
                  <div className="font-mono text-sm">@{c.handle}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(c.scrapedAt).toLocaleString('ko-KR')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressView({
  log,
  elapsed,
  progress,
  onCancel,
}: {
  log: string[];
  elapsed: number;
  progress: ProgressFrame | null;
  onCancel: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log.length]);

  const pct = computeProgress(progress);
  const stageLabel = progress
    ? STAGE_LABEL[progress.stage]
    : '시작 중';

  return (
    <div className="border border-neutral-800 rounded-xl p-6 bg-neutral-900/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <span className="text-sm font-semibold">{stageLabel}</span>
          {progress?.total != null && progress.index != null && (
            <span className="text-xs text-neutral-500 font-mono">
              {progress.index}/{progress.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-500 font-mono">{formatElapsed(elapsed)}</div>
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-xs border border-neutral-700 hover:border-rose-500 hover:text-rose-300 transition"
          >
            취소
          </button>
        </div>
      </div>

      <div className="h-1.5 bg-neutral-800 rounded overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div
        ref={logRef}
        className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto"
      >
        {log.map((line, i) => (
          <div
            key={i}
            className={
              i === log.length - 1
                ? 'text-neutral-100'
                : 'text-neutral-500'
            }
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGE_LABEL: Record<ProgressFrame['stage'], string> = {
  scraping: '게시물 수집 중',
  analyzing: 'AI 분석 중',
  saving: '저장 중',
};

function computeProgress(p: ProgressFrame | null): number {
  if (!p) return 2;
  if (p.stage === 'scraping') {
    if (p.total && p.index != null) return Math.min(40, (p.index / p.total) * 40);
    return 8;
  }
  if (p.stage === 'analyzing') {
    if (p.total && p.index != null) return 40 + (p.index / p.total) * 55;
    return 45;
  }
  if (p.stage === 'saving') return 98;
  return 0;
}

function ResultsView(props: {
  account: Account;
  savedTo: string | null;
  elapsed: number;
  partialError: string | null;
  onReset: () => void;
  onReanalyze: () => void;
}) {
  const { account } = props;
  const totalLikes = account.posts.reduce((sum, p) => sum + p.likes, 0);
  const totalReplies = account.posts.reduce((sum, p) => sum + p.replies, 0);
  const analyzedCount = account.posts.filter((p) => p.analysis).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">@{account.handle}</h2>
          <p className="text-neutral-400">{account.displayName}</p>
          {account.bio && <p className="text-sm text-neutral-500 mt-1">{account.bio}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={props.onReanalyze}
            className="px-3 py-1.5 rounded border border-neutral-700 hover:border-blue-400 hover:text-blue-200 text-sm transition"
          >
            재분석
          </button>
          <button
            onClick={props.onReset}
            className="px-3 py-1.5 rounded border border-neutral-700 hover:border-neutral-500 text-sm"
          >
            새 분석
          </button>
        </div>
      </div>

      {props.partialError && (
        <div className="border border-amber-500/40 bg-amber-950/20 rounded-lg p-3 text-sm">
          <span className="font-semibold text-amber-200">부분 실패</span>
          <span className="text-neutral-300 ml-2 whitespace-pre-wrap">{props.partialError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="팔로워" value={account.followers.toLocaleString('ko-KR')} />
        <Stat label="게시물" value={`${account.posts.length}개 (분석 ${analyzedCount})`} />
        <Stat label="총 좋아요" value={totalLikes.toLocaleString('ko-KR')} />
        <Stat label="총 댓글" value={totalReplies.toLocaleString('ko-KR')} />
      </div>

      {account.summary && <SummaryPanel summary={account.summary} />}

      {props.savedTo && (
        <p className="text-xs text-neutral-500 font-mono">
          저장됨: {props.savedTo}
          {props.elapsed > 0 && ` · 소요 ${formatElapsed(props.elapsed)}`}
        </p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wider">
          게시물별 분석
        </h3>
        <div className="space-y-3">
          {account.posts
            .slice()
            .sort((a, b) => (b.analysis?.popularityScore ?? 0) - (a.analysis?.popularityScore ?? 0))
            .map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: AccountSummary }) {
  return (
    <div className="border border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-emerald-950/20 rounded-xl p-5 space-y-4">
      <h3 className="text-sm uppercase tracking-wider text-blue-300 font-semibold">
        다음 콘텐츠 액션
      </h3>

      <ol className="space-y-2.5">
        {summary.topActions.map((action, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
              {i + 1}
            </span>
            <span className="pt-0.5 text-sm leading-relaxed">{action}</span>
          </li>
        ))}
      </ol>

      <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-blue-500/20">
        <div>
          <h4 className="text-xs uppercase tracking-wider text-neutral-400 mb-1.5">반복 패턴</h4>
          <ul className="space-y-1 text-sm text-neutral-200">
            {summary.winningPatterns.map((pattern, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-blue-400">·</span>
                <span>{pattern}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-neutral-400 mb-1">포지셔닝</h4>
            <p className="text-sm text-neutral-200">{summary.positioning}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-neutral-400 mb-1">독자</h4>
            <p className="text-sm text-neutral-200">{summary.audienceProfile}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/30">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const a = post.analysis;
  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 hover:bg-neutral-900/40 transition"
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 text-xs text-neutral-500">
              <span>♥ {post.likes.toLocaleString('ko-KR')}</span>
              <span>·</span>
              <span>💬 {post.replies.toLocaleString('ko-KR')}</span>
              {post.postedAt && (
                <>
                  <span>·</span>
                  <span>{new Date(post.postedAt).toLocaleDateString('ko-KR')}</span>
                </>
              )}
              {a && (
                <>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    {a.contentType}
                  </span>
                </>
              )}
            </div>
            <p className="text-sm line-clamp-3 whitespace-pre-wrap">{post.content || '(빈 게시물)'}</p>
          </div>
          {a && (
            <div className="flex flex-col items-end shrink-0">
              <div className={`text-2xl font-bold tabular-nums ${scoreColor(a.popularityScore)}`}>
                {a.popularityScore}
              </div>
              <div className="text-[10px] text-neutral-500">SCORE</div>
            </div>
          )}
        </div>
      </button>
      {open && a && <AnalysisPanel post={post} analysis={a} />}
      {open && !a && (
        <div className="border-t border-neutral-800 p-4 text-sm text-neutral-500">
          분석 실패 또는 누락. 본문/댓글만 표시됨.
          {post.comments.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-neutral-400">
              {post.comments.slice(0, 5).map((c, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-neutral-500">@{c.author}</span>{' '}
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisPanel({ post, analysis }: { post: Post; analysis: Analysis }) {
  return (
    <div className="border-t border-neutral-800 p-4 space-y-4 bg-neutral-950/40">
      <Section title="인기 요인">
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {analysis.popularityReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Section>

      <Section title="댓글 주제">
        <div className="space-y-2">
          {analysis.commentThemes.map((t, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <div className="font-medium text-neutral-200">{t.theme}</div>
                <div className="text-xs text-neutral-500">{(t.share * 100).toFixed(0)}%</div>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded mt-1 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${Math.min(100, t.share * 100)}%` }}
                />
              </div>
              <div className="text-xs text-neutral-400 mt-1">{t.summary}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="댓글 감정">
        <div className="flex h-2 rounded overflow-hidden">
          <div
            className="bg-emerald-500"
            style={{ width: `${analysis.sentiment.positive * 100}%` }}
            title={`긍정 ${(analysis.sentiment.positive * 100).toFixed(0)}%`}
          />
          <div
            className="bg-neutral-500"
            style={{ width: `${analysis.sentiment.neutral * 100}%` }}
            title={`중립 ${(analysis.sentiment.neutral * 100).toFixed(0)}%`}
          />
          <div
            className="bg-rose-500"
            style={{ width: `${analysis.sentiment.negative * 100}%` }}
            title={`부정 ${(analysis.sentiment.negative * 100).toFixed(0)}%`}
          />
        </div>
        <div className="flex gap-3 text-xs mt-1.5 text-neutral-400">
          <span>긍정 {(analysis.sentiment.positive * 100).toFixed(0)}%</span>
          <span>중립 {(analysis.sentiment.neutral * 100).toFixed(0)}%</span>
          <span>부정 {(analysis.sentiment.negative * 100).toFixed(0)}%</span>
        </div>
      </Section>

      <Section title="마케터 인사이트">
        <ul className="space-y-2">
          {analysis.marketerInsights.map((insight, i) => (
            <li
              key={i}
              className="text-sm border-l-2 border-blue-500/60 pl-3 py-1 bg-blue-500/5"
            >
              {insight}
            </li>
          ))}
        </ul>
      </Section>

      {post.comments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
            원본 댓글 보기 ({post.comments.length}개)
          </summary>
          <ul className="mt-2 space-y-1.5 max-h-72 overflow-y-auto">
            {post.comments.map((c, i) => (
              <li key={i} className="text-neutral-400">
                <span className="font-mono text-xs text-neutral-500">@{c.author}</span>{' '}
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="text-xs text-neutral-600 font-mono">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-neutral-400 underline underline-offset-2"
        >
          원본 게시물 ↗
        </a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-neutral-200';
  return 'text-neutral-500';
}

// SSE consumer over fetch ReadableStream. Buffers partial frames across reads
// and parses `event: NAME\ndata: JSON\n\n` blocks.
async function consumeSse(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onProgress: (frame: ProgressFrame) => void;
    onAccount: (account: Account) => void;
    onError: (msg: string) => void;
    onDone: (data: { savedTo: string | null }) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        if (event === 'progress') handlers.onProgress(parsed as ProgressFrame);
        else if (event === 'account') handlers.onAccount(parsed as Account);
        else if (event === 'error') handlers.onError(parsed.message);
        else if (event === 'done') handlers.onDone(parsed);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
