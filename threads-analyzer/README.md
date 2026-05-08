# Threads Analyzer

핸들 입력 → Threads 인기 게시물 자동 수집 → Claude 분석 → 마케터 인사이트.
PRD 기준 한 사이클 3분 이내. 자세한 스펙은 PRD 참고.

현재 단계: **Phase 2 (웹 UI + AI 분석 통합)**

- 입력 / 진행 / 결과 3개 화면 단일 페이지
- `/api/analyze` SSE 엔드포인트 (스크래핑 → Claude 병렬 분석)
- 모델: Claude Sonnet 4.6 기본 (Haiku 4.5 / Opus 4.7 선택 가능)
- 결과는 `data/{handle}.json`에 저장 → 같은 핸들 재진입 시 캐시 카드로 노출
- Phase 1 의 CLI 스크래퍼 (`npm run scrape`) 도 그대로 동작

---

## Setup

### 1. 의존성 설치

```bash
cd threads-analyzer
npm install
npx playwright install chromium
```

`npx playwright install chromium` 은 Playwright 번들 브라우저를 받아오는
단계. 사내망에서 막히면 `PLAYWRIGHT_DOWNLOAD_HOST` 미러 지정 또는 시스템
Chrome 사용 설정 필요.

### 2. 환경변수

```bash
cp .env.example .env
```

`.env`:

```env
THREADS_USER_DATA_DIR=./.threads-session
ANTHROPIC_API_KEY=sk-ant-...        # Phase 2부터 필수
```

### 3. 최초 1회 — Threads 로그인

Threads는 비로그인 시 컨텐츠 노출이 제한적이라 **부계정으로 한 번 로그인**
해서 세션 쿠키를 `.threads-session/` 에 저장해두는 방식으로 운영한다.

```bash
npm run scrape -- --handle threads --headful
```

브라우저 창이 뜨면:

1. Threads 로 로그인 (부계정 권장 — 차단 리스크 격리)
2. 프로필이 정상적으로 보이는지 확인
3. 터미널은 그대로 두고 종료해도 됨 (`Ctrl+C`)

다음 실행부터는 헤드리스로 자동 수행.

> 운영 주의: 본인 메인 계정으로 로그인하지 말 것. 차단 시 본 계정에 영향.

---

## Usage

### 웹 UI (기본)

```bash
npm run dev
# → http://localhost:3000
```

화면:

1. **입력** — 핸들, 게시물 수 (5/10/20), 모델 선택
2. **진행** — SSE 텍스트 스트림으로 단계별 메시지
3. **결과** — 계정 요약 카드 + 게시물별 카드 (펼치면 AI 분석 패널)

분석이 끝나면 결과는 `data/{handle}.json` 으로 자동 저장되며 입력 화면 하단의
"최근 분석" 목록에서 클릭 한 번으로 다시 펼쳐 볼 수 있다 (재분석 없이).

### CLI 스크래퍼 (Phase 1)

```bash
# 기본 — 게시물 10개, 댓글 20개씩, 헤드리스
npm run scrape -- --handle marketing_kim

# 게시물/댓글 수 조정
npm run scrape -- --handle marketing_kim --posts 5 --comments 20

# 결과를 data/{handle}.json 으로도 저장
npm run scrape -- --handle marketing_kim --save

# 디버깅용 — 브라우저 보이게
npm run scrape -- --handle marketing_kim --headful
```

CLI 는 stdout 으로 JSON 1개, 진행 로그는 stderr 분리 → 파이프 안전.

---

## API

### `POST /api/analyze`

요청 body:

```json
{
  "handle": "marketing_kim",
  "posts": 10,
  "comments": 20,
  "model": "claude-sonnet-4-6"
}
```

응답: `text/event-stream` (SSE) — 다음 4가지 이벤트.

| event | data |
|-------|------|
| `progress` | `{ stage: "scraping" \| "analyzing" \| "saving", message: string, index?, total? }` |
| `account` | 완성된 `Account` JSON (PRD §5 스키마) |
| `error` | `{ message: string }` (치명적 / 부분 실패) |
| `done` | `{ handle, savedTo: string \| null }` (스트림 종료) |

### `GET /api/cached`

`data/` 에 저장된 분석 목록.

```json
{ "entries": [ { "handle": "marketing_kim", "scrapedAt": "...", "size": 12345 } ] }
```

### `GET /api/cached?handle=marketing_kim`

저장된 `Account` JSON 그대로 반환 (404 if missing).

---

## 출력 스키마

```ts
type Account = {
  handle: string
  displayName: string
  bio: string
  followers: number
  scrapedAt: string
  posts: Post[]
}

type Post = {
  id: string
  url: string
  content: string
  postedAt: string
  likes: number
  replies: number
  comments: { author: string; text: string }[]
  analysis?: Analysis
}

type Analysis = {
  popularityScore: number              // 1-100
  contentType: string                  // "리스트형 팁" 등
  popularityReasons: string[]          // 3개
  commentThemes: { theme: string; share: number; summary: string }[]
  sentiment: { positive: number; neutral: number; negative: number }
  marketerInsights: string[]           // 2-3개
}
```

전체 타입은 `src/types/index.ts`.

---

## 구조

```
threads-analyzer/
├── scripts/
│   └── scrape.ts             # Phase 1 CLI 엔트리
├── src/
│   ├── app/
│   │   ├── page.tsx          # 입력 / 진행 / 결과 단일 페이지
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── analyze/route.ts   # SSE 스트리밍 엔드포인트
│   │       └── cached/route.ts    # 캐시 목록 + 단건 로드
│   ├── analyzer/
│   │   ├── prompts.ts        # 시스템/유저 프롬프트, zod 스키마
│   │   └── analyze.ts        # Claude 호출 + 병렬 러너
│   ├── scraper/
│   │   ├── scrape.ts         # Playwright 스크래핑 (onProgress 훅)
│   │   └── selectors.ts      # Threads DOM 셀렉터 (변경 시 첫 수정 지점)
│   ├── lib/
│   │   ├── sse.ts            # SSE 와이어 포맷 헬퍼
│   │   └── storage.ts        # data/{handle}.json read/write/list
│   └── types/
│       └── index.ts          # 공유 타입
├── data/                     # 분석 결과 저장 (gitignored)
└── .threads-session/         # Playwright persistent profile (gitignored)
```

---

## 모델 선택

기본은 `claude-sonnet-4-6`. UI 의 드롭다운에서 변경 가능.

| 모델 | 언제 |
|------|------|
| `claude-sonnet-4-6` | 기본. 균형 잡힌 품질·속도. |
| `claude-haiku-4-5` | 더 빠르고 저렴. 게시물 수가 많거나 3분 예산이 빠듯할 때. |
| `claude-opus-4-7` | 최고 품질, 가장 느림. 인사이트 정확도가 중요한 단발 분석용. |

`effort: "medium"` 으로 호출 (Sonnet 4.6 기본 `high` 보다 토큰 ~30-40% 절감).

---

## 트러블슈팅

| 증상 | 조치 |
|------|------|
| 로그인 화면이 계속 뜸 | `.threads-session/` 삭제 후 `npm run scrape -- --handle X --headful` 로 재로그인 |
| `followers` 가 0 | 비공개 계정이거나 Threads 셀렉터 변경 → `selectors.ts` 의 `profile.followersAnchor` 점검 |
| `posts` 가 비어있음 | `selectors.ts` / `collectPostUrls` 의 anchor 매칭 점검 |
| 분석 단계에서 "parse failed" | 프롬프트 응답이 스키마와 안 맞음. `src/analyzer/prompts.ts` 의 시스템 프롬프트 강화 또는 `max_tokens` 증가 |
| `ANTHROPIC_API_KEY is not set` | `.env` 에 키 입력 후 `npm run dev` 재시작 |
| 자주 차단됨 | 부계정 분리, `scrape.ts` 의 `randSleep(2000, 4000)` 상향 |
| Vercel 등 호스팅 시 timeout | `route.ts` 의 `maxDuration` 조정. 무료 플랜은 10초로 SSE가 끊긴다 — 로컬 운영 권장. |

---

## 한계 (Threads 제약)

- **저장/발송 메트릭** 수집 불가 (작성자만 보는 비공개 데이터)
- 인기도는 좋아요·댓글·팔로워 비율로 근사 (`popularityScore`)
- 셀렉터 기반 스크래핑 — Threads 가 레이아웃 바꾸면 `selectors.ts` 수정 필요
