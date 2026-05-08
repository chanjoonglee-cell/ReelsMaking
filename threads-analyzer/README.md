# Threads Analyzer

핸들 입력 → Threads 인기 게시물 자동 수집 → Claude 분석 → 마케터 인사이트.
PRD 기준 한 사이클 3분 이내. 자세한 스펙은 프로젝트 루트의 PRD 참고.

현재 단계: **Phase 1 (스크래퍼 CLI 검증)**

---

## Setup

### 1. 의존성 설치

```bash
cd threads-analyzer
npm install
npx playwright install chromium
```

`npx playwright install chromium` 은 Playwright 번들 브라우저를 받아오는
단계. 회사 네트워크에서 막히면 `PLAYWRIGHT_DOWNLOAD_HOST` 미러를 지정하거나
시스템 Chrome 을 사용하도록 별도 설정 필요.

### 2. 환경변수

```bash
cp .env.example .env
```

`.env`:

```env
THREADS_USER_DATA_DIR=./.threads-session
ANTHROPIC_API_KEY=          # Phase 2에서 사용. Phase 1엔 불필요.
```

### 3. 최초 1회 — Threads 로그인

Threads는 비로그인 시 컨텐츠 노출이 제한적이라 **부계정으로 한 번 로그인**
해서 세션 쿠키를 `.threads-session/` 에 저장해두는 방식으로 운영함.

```bash
npm run scrape -- --handle threads --headful
```

브라우저 창이 뜨면:

1. Threads 로 로그인 (부계정 권장 — 차단 리스크 격리)
2. 프로필이 정상적으로 보이는지 확인
3. 터미널은 그대로 두고 일단 종료해도 됨 (`Ctrl+C`)
4. 다음 실행부터는 `--headful` 빼고 헤드리스로 가능

세션은 `.threads-session/` 에 저장되며 `.gitignore` 에 포함됨.

> 운영 주의: 본인 메인 계정으로 로그인하지 말 것. 차단 시 본 계정에 영향 감.

---

## Usage

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

stdout 으로 PRD §5 스키마의 JSON 1개를 출력. 진행 로그는 stderr 로 분리되어
파이프해도 안전함.

```bash
npm run scrape -- --handle marketing_kim > data/marketing_kim.json
```

---

## 출력 스키마 (요약)

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
  analysis?: Analysis  // Phase 2에서 채워짐
}
```

전체 타입은 `src/types/index.ts` 참고.

---

## 구조

```
threads-analyzer/
├── scripts/
│   └── scrape.ts          # CLI 엔트리포인트 (인자 파싱, 출력)
├── src/
│   ├── scraper/
│   │   ├── scrape.ts      # Playwright 스크래핑 로직
│   │   └── selectors.ts   # Threads DOM 셀렉터 (변경 시 첫 수정 지점)
│   └── types/
│       └── index.ts       # 공유 타입
├── data/                  # --save 출력 위치 (gitignored)
└── .threads-session/      # Playwright persistent profile (gitignored)
```

---

## 트러블슈팅

| 증상 | 원인/조치 |
|------|----------|
| 로그인 화면이 계속 뜸 | `.threads-session/` 삭제 후 `--headful` 로 재로그인 |
| `followers` 가 0 | 비공개 계정이거나 Threads 가 셀렉터 변경 → `selectors.ts` 의 `profile.followersAnchor` 점검 |
| `posts` 가 비어있음 | 마찬가지로 `selectors.ts` / `collectPostUrls` 의 anchor 매칭 점검 |
| 자주 차단됨 | 부계정으로 분리, 게시물 사이 sleep 늘리기 (`scrape.ts` 의 `randSleep(2000, 4000)`) |
| 셀렉터 깨짐 | `src/scraper/selectors.ts` 한 파일에서 후보 추가 |

---

## 다음 단계 (Phase 2 예정)

- `/api/analyze` SSE 엔드포인트
- Claude (Sonnet 4.6 기본) 병렬 호출로 게시물별 분석
- 입력 / 진행 / 결과 3개 화면
- `data/{handle}.json` 캐시
