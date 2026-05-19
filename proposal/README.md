# 정부사업계획서 워크플로우

`올해의 K-스타트업 2026 · 혁신창업리그` 사업계획서 작성을 위한 코칭/리뷰 파이프라인.

- **목표**: 사용자의 기존 초안을 공식 PSST 양식에 맞춰 진단하고, 그대로 붙여넣을 수 있는 개정안을 자동 생성한다.
- **출력**: 평가 리포트(`report.md`) + 양식 붙여넣기용 본문(`revised-body.md`) → 공식 `.hwpx` 양식에 복붙.
- **다음 리그**: 혁신리그 완성 후 동일 구조로 `templates/ai-league-2026.json` 추가 → AI리그 진행.

## 디렉터리 구조

```
proposal/
├── README.md              ← 이 파일
├── templates/
│   └── innovation-league-2026.json   # 공식 양식 구조 + 평가기준
├── prompts/
│   └── review.md          # GPT-4o 코치 시스템 프롬프트
├── src/
│   ├── 1-parseDraft.js    # .txt/.md/.docx/.hwp(x) → 텍스트
│   ├── 2-mapToSections.js # 초안 → PSST 세부항목별 분배
│   ├── 3-review.js        # 항목별 점수/갭/개정안 생성
│   └── 4-exportReport.js  # 리포트 + 붙여넣기용 본문 생성
├── input/                 # 사용자 초안 (.docx/.hwp/.txt) 드롭
└── output/                # 자동 생성 (gitignore)
    ├── draft.text.json
    ├── mapped.json
    ├── review.json
    ├── report.md          ← 사용자가 읽는 리포트
    └── revised-body.md    ← 양식에 붙여넣을 본문
```

## 사용 절차

### 0. 1회 준비
```bash
npm install openai mammoth dotenv
# HWP 파싱이 필요한 경우만:
pip install pyhwp
echo "OPENAI_API_KEY=sk-..." >> .env
```

### 1. 공식 양식 다운로드 (사용자가 직접)
1. https://www.k-startup.go.kr 접속 → "올해의 K-스타트업 2026 혁신창업리그" 공고 검색
2. `사업계획서_양식(혁신창업리그).hwpx` 다운로드 → `proposal/templates/원본양식/` 에 저장
3. 누리집 사전 가입 + 실명/기업 인증 완료해 두기 (접수 직전 인증 시도 시 마감 위험)

### 2. 초안 투입
```bash
cp ~/내사업계획서_초안.docx proposal/input/
```
하나 이상의 파일을 넣어도 되며, 자동으로 합쳐서 분석한다.

### 3. 파이프라인 실행
```bash
node proposal/src/1-parseDraft.js
node proposal/src/2-mapToSections.js
node proposal/src/3-review.js
node proposal/src/4-exportReport.js
```

또는 한 줄로:
```bash
node proposal/src/1-parseDraft.js && \
  node proposal/src/2-mapToSections.js && \
  node proposal/src/3-review.js && \
  node proposal/src/4-exportReport.js
```

### 4. 결과 확인 → 양식에 반영
1. `proposal/output/report.md` 를 열어 항목별 점수/갭 확인
2. WEAK·MISSING 항목 위주로 본인 정보를 보강해 `proposal/input/` 의 초안 업데이트 → 2~4단계 재실행
3. STRONG·OK 도달하면 `revised-body.md` 의 각 섹션을 `.hwpx` 공식 양식의 동일 itemId 항목에 복붙
4. 본문 15페이지 이내 확인 → K-Startup 누리집 업로드

## 공식 양식 구조 요약 (혁신리그 2026)

| Section | itemId | 항목 | 페이지 예산 |
|---|---|---|---|
| 일반현황 | 0-1~0-4 | 기업/대표/매출/팀 | 1p |
| 요약 | OV-1~OV-4 | 아이템·차별성·시장·대표이미지 | 1p |
| 1. 문제인식 | 1-1, 1-2 | 배경/필요성, 시장(고객) 분석 | 3p |
| 2. 실현가능성 | 2-1, 2-2 | 현황(TRL/MVP), 고도화 방안 | 4p |
| 3. 성장전략 | 3-1, 3-2, 3-3 | BM, GTM, 일정·자금 | 5p |
| 4. 팀구성 | 4-1, 4-2 | 대표/팀, 외부협력 | 2p |

(상세는 `templates/innovation-league-2026.json` 참조)

## HWP 출력 관련 주의

- Node.js로 .hwpx 를 직접 생성하는 안정적인 라이브러리는 없음
- 따라서 이 워크플로우는 **공식 양식 파일을 그대로 두고, 본문 텍스트만 자동 생성**해서 사용자가 복붙하는 방식
- 양식의 표/이미지 자리는 사용자가 직접 채워야 함 (간트차트, 자금운용 표, 팀 조직도 등)

## AI리그 확장 (다음 단계)

혁신리그 결과물 확정 후:
1. `templates/ai-league-2026.json` 생성 (AI리그 양식 기반)
   - AI 기술 차별성, 데이터셋·모델, AI 윤리/거버넌스 추가 항목
2. `prompts/review-ai.md` 로 AI 특화 평가 기준 반영
3. 동일 파이프라인 재실행
