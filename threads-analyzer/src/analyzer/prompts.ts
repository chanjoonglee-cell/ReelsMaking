import { z } from 'zod';
import type { Post } from '../types';

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
