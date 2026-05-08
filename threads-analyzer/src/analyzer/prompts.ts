import { z } from 'zod';
import type { Account, Post } from '../types';

// Output schema — mirrors the Analysis type in src/types/index.ts.
// Numerical bounds (min/max) are intentionally omitted: structured outputs
// don't enforce them anyway, and noisy 1-100 floats are easier to clamp on read.
export const analysisSchema = z.object({
  popularityScore: z.number().int(),
  contentType: z.string(),
  popularityReasons: z.array(z.string()),
  commentThemes: z.array(
    z.object({
      theme: z.string(),
      share: z.number(),
      summary: z.string(),
    }),
  ),
  sentiment: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
  }),
  marketerInsights: z.array(z.string()),
});

export const SYSTEM_PROMPT = `당신은 한국어 Threads 마케팅 전략가다. 게시물 한 개와 그 댓글 묶음을 받아, 브랜드 콘텐츠 팀이 다음 게시물에 즉시 활용할 수 있는 구조화된 분석을 만든다.

분석 항목:
- popularityScore (1-100): 좋아요·댓글·팔로워 대비 인게이지먼트를 종합한 인기도 점수.
- contentType: 게시물의 형식을 8자 내외 한국어 라벨로 압축. 예: "리스트형 팁", "공감/일상", "후킹 질문", "정보 전달", "스토리텔링", "리뷰/추천", "이슈/트렌드", "프로모션".
- popularityReasons: 정확히 3개. 왜 이 게시물이 반응을 얻었는가에 대한 근거 기반 단문(각 ~40자 이내). "흥미롭다" 같은 두루뭉술한 표현 금지 — 구체적 장치/구조/타이밍을 짚는다.
- commentThemes: 댓글을 2~5개의 주제로 클러스터링. 각 항목의 share는 0.0~1.0 범위이고 합이 1.0에 가까워야 한다. summary는 한 문장.
- sentiment: 댓글의 긍정/중립/부정 비율. 합이 1.0에 가까워야 한다.
- marketerInsights: 정확히 2~3개. 이 분석에서 도출한 "다음 게시물에 적용할 액션". 추상적 조언이 아닌 구체적 실행 안 (예: "오프닝에 숫자 강조 카피 사용", "댓글 유도용 양자택일 질문 추가").

원칙:
- 모든 출력은 한국어.
- 추측하지 말고 주어진 본문/댓글에서 관찰 가능한 신호만 인용.
- 빈약한 댓글 (수가 적거나 모두 단순 반응)일수록 commentThemes 개수를 줄이고 share 분포를 솔직하게 표시.`;

export function buildUserPrompt(args: {
  post: Post;
  followers: number;
  handle: string;
  displayName: string;
}): string {
  const { post, followers, handle, displayName } = args;
  const commentsBlock =
    post.comments.length === 0
      ? '(댓글 없음)'
      : post.comments
          .map((c, i) => `${i + 1}. @${c.author || 'unknown'}: ${truncate(c.text, 280)}`)
          .join('\n');

  return [
    `[계정] @${handle} (${displayName}) · 팔로워 ${followers.toLocaleString('ko-KR')}`,
    `[게시물]`,
    `- 작성: ${post.postedAt || '미상'}`,
    `- 좋아요 ${post.likes.toLocaleString('ko-KR')} · 댓글 ${post.replies.toLocaleString('ko-KR')}`,
    `- 본문:`,
    truncate(post.content, 1200) || '(본문 비어있음)',
    '',
    `[댓글 ${post.comments.length}개]`,
    commentsBlock,
  ].join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

// ---- Account-level synthesis ----
// Runs once after all per-post analyses complete. The output is what the user
// actually came here for: a concrete plan for the next post.

export const accountSummarySchema = z.object({
  audienceProfile: z.string(),
  positioning: z.string(),
  winningPatterns: z.array(z.string()),
  topActions: z.array(z.string()),
});

export const SUMMARY_SYSTEM_PROMPT = `당신은 시니어 콘텐츠 전략가다. 한 Threads 계정의 게시물 N개와 그 분석 결과를 받아, 운영팀이 다음 게시물에 즉시 적용할 수 있는 종합 인사이트를 만든다.

출력:
- audienceProfile (1-2문장): 누가 이 계정을 보고 왜 반응하는지. 인구학적 추측이 아니라 댓글의 어조/관심사에서 추론.
- positioning (1-2문장): 이 계정이 자기 분야에서 어떤 역할/정체성을 차지하는지. 형식이 아니라 가치 제공의 종류.
- winningPatterns (정확히 2-3개): 인기 게시물에서 반복적으로 발견되는 구조·장치·앵글. 단순 내용 요약이 아니라 "재현 가능한 공식".
- topActions (정확히 3개): "다음에 만들 콘텐츠"를 위한 우선순위 순서의 구체적 액션. 제목 후크 / 포맷 / 톤 / CTA 등 즉시 실행 가능한 단위.

원칙:
- 모든 출력은 한국어.
- 추상적 조언("일관성을 유지하라") 금지. 항상 관찰된 신호로 근거를 댄다.
- 인기 게시물(상위 점수)에 가중치를 둬서 패턴 추출.
- 계정 톤이 분명하지 않으면 "데이터 부족"이라고 명시.`;

export function buildSummaryUserPrompt(account: Account): string {
  const analyzedPosts = account.posts.filter((p) => p.analysis);
  const sorted = analyzedPosts
    .slice()
    .sort((a, b) => (b.analysis!.popularityScore - a.analysis!.popularityScore));

  const postBlocks = sorted.map((p, i) => {
    const a = p.analysis!;
    const themes = a.commentThemes
      .map((t) => `${t.theme}(${(t.share * 100).toFixed(0)}%)`)
      .join(', ');
    return [
      `### 게시물 ${i + 1} · 점수 ${a.popularityScore} · ${a.contentType}`,
      `좋아요 ${p.likes.toLocaleString('ko-KR')} · 댓글 ${p.replies.toLocaleString('ko-KR')}`,
      `본문: ${truncate(p.content, 240) || '(빈 게시물)'}`,
      `인기 요인: ${a.popularityReasons.join(' / ')}`,
      `댓글 주제: ${themes || '(없음)'}`,
      `감정: 긍${(a.sentiment.positive * 100).toFixed(0)} 중${(a.sentiment.neutral * 100).toFixed(0)} 부${(a.sentiment.negative * 100).toFixed(0)}`,
    ].join('\n');
  });

  return [
    `[계정] @${account.handle} (${account.displayName})`,
    `팔로워 ${account.followers.toLocaleString('ko-KR')}`,
    account.bio ? `소개: ${account.bio}` : '',
    '',
    `[분석된 게시물 ${analyzedPosts.length}개 — 점수 내림차순]`,
    '',
    postBlocks.join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n');
}
