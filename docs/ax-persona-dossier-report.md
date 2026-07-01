# [AX 멘토링 과제] 유저 페르소나 dossier — 설계·실증 정리

> 작성 2026-06-30 · 이찬중 · 용도: AX 멘토링 보고(김재운) + 개발 공유(서동재)
> 관련: Slack `#ax_prompt-ops` · 에이전트 전략문서 `language-learning-agent-strategy.md` · repo `languageforest-backend`

---

## 0. 배경 — 이 과제가 답하려는 질문

6/22 AX 멘토링에서 나온 핵심 지적:
> "스킬·훅·스케줄링은 메인이 아니다. 보조도구다. 본질은 **판단 & 질문**, 그리고 현시점 LLM AI의 본질은 **컨텍스트 관리** — 맥락을 얼마나·어느 퀄리티로·윈도우 안에서 어떻게 관리할지."

본 문서는 이 지적에 대한 PoC 응답이다. 결론부터:
> **그 "컨텍스트 관리"의 실체 = 유저 일기에서 페르소나(dossier)를 추출해, 학습 생성·교정의 컨텍스트로 주입하는 엔진.** 무엇을(맥락) 얼마나·어떤 퀄리티로 넣을지가 곧 dossier 추출·압축 정책이다.

---

## 1. 목적함수 — 이 시스템이 최적화하는 단 하나

> **유저의 생각을, 그 사람답게(맥락·성향·성격), 오차 없이 외국어로.** (그래서 결국 즉각적으로도)

- **"오차"의 재정의:** 이 앱에서 오차는 문법 오류가 아니다. **번역 과정에서 "그 사람"(맥락·성향)이 증발하는 것**이다. 의미는 맞는데 그 사람이 아닌 영어가 나오면, 그게 진짜 오차.
- **왜 일기가 소재인가:** 언어학습의 본질 = 내 모국어 생각을 외국어로 표현하는 것. 소재가 나에게서 나와야 동기(자기참조)가 생기고, 자기 목소리로 나온 영어라야 빨리 인출되어 즉각성으로 이어진다.
- 즉 **fidelity(그 사람다움)가 1차, 즉각성은 그 위에 따라오는 2차.**

---

## 2. 페르소나 = 4축

각 축은 **특정 서브에이전트의 특정 결정을 바꾼다.** (바꾸지 않으면 페르소나가 아니라 장식)

| 축 | 무엇 | 주 소스 | 쓰는 곳 |
|---|---|---|---|
| **① content** | 소재·관심·맥락·관계 | 사진 + 텍스트 | problem-generator(소재) |
| **② voice** | 문체·어투 (그 사람다움) | 텍스트 only | 대시보드 + (나중) 변종 추천 |
| **③ language_profile** | 실력·반복오류·즉각성 병목 | 연습·채점 | generator(난이도)·tutor(교정) |
| **④ engagement** | 동기·끈기·타이밍 | 세션·streak·결제 | review-scheduler(타이밍) |

**추가 갈래:** content 안에 "학습 목표(why)", voice 안에 "사고 패턴(결론선행 vs 맥락선행)"이 심층으로 딸려온다.

---

## 3. 추출 원리 — 2채널 × 3층

**입력 2채널 (비대칭 주의):**
- **텍스트(일기)** → voice + content (어투는 오직 텍스트에만)
- **사진** → content 집중 (객체·장면·인물·분위기). vision 필요, 현재 미활용(전략문서 M1).
- 핵심: 사진은 content를 폭발적으로 강화하지만 voice엔 기여 0. **둘은 대체재가 아니라 보완재.**

**추출 3층:**
- **L1 선언** → SELECT (결정론)
- **L2 행동** → 집계 쿼리 (결정론)
- **L3 의미** → LLM (텍스트→voice/content, 사진→content) → dossier diff

**결정론 vs LLM:** voice만 순수 LLM, engagement는 순수 SQL, content·language는 혼합. → 이 분리가 비용·속도·신뢰를 가른다.

**엔진(persona-analyzer):** dossier의 **유일한 진입점**. 매번 전체 재생성이 아니라 (기존 dossier + 새 일기)로 **diff**만 갱신. 4 서브에이전트는 dossier를 **읽기만** 한다. 병합 원칙 = evidence 없으면 버림 · 행동>선언 · 충돌 시 덮어쓰기 금지.

---

## 4. 시스템 5층 구조

```
0층 · 목적함수  (그 사람답게, 오차 없이)
      ↓
1층 · 입력      텍스트(voice+content) / 사진(content)
      ↓
2층 · 엔진      persona-analyzer  (L1 SQL · L2 집계 · L3 LLM → diff)
      ↓
3층 · 저장      dossier  ① content ② voice ③ language ④ engagement
      ↓
4층 · 소비      problem-generator · socratic-tutor · review-scheduler
      ↺ 갱신 루프 (일기 쌓일수록 dossier 풍부 → 개인화↑ → 복리)
```
접근 원칙: **엔진이 유일한 진입점, 저장(3층 스키마)이 계약의 중심.** 스키마만 고정하면 위(추출)·아래(소비)를 독립적으로 교체 가능.

---

## 5. 실유저 검증 — 같은 엔진, 다른 사람 (핵심 증거)

실데이터 CSV로 추출(텍스트만, 사진 제외). 두 사람 모두 **`interests` 선언값이 `null`**인데, 행동에서 뽑은 페르소나는 정반대.

### 5.1 찬중 (대표 본인 · 29세 · 일기 26 / 연습 105 / 173일)

**① content**
- interests: 창업/제품 0.95(전사전략회의·카벤 VC미팅"투자받을지도?"·청창사 합격·KAIST 데모데이·발표) / 음식 0.8(고등어회 "존맛탱"·평양냉면) / 자연산책 0.65(호수공원·벚꽃·하늘, 반복) / 아침운동 0.45
- people: 형(케이크, "이런 형이 없다"), 찬혁(제주 풀코스), 이호성(대학원 동기·VC 심사역), 고양이
- life_context: 창업가/개발자, 서울↔대전(KAIST), focus=투자유치·앱 출시
- desires(내부용): 투자 유치 · 연애("내 취향과 사랑 방식에 고민")

**② voice**
- register: 반말 담담체, 감정 실리면 폭발 / ending: "~다"체
- signature: "존맛탱", "음하하", "~다아아아", "의지 짱", "큰일이다", "ㅠㅠㅠ"
- humor: 자조("저 얼굴이 다정함이 맞나?") / 자기성찰 높음
- english_mapping: dry·punchy·단문, "존맛탱"→straight-up unreal, "~다아아아"→강세 반복

**③ language_profile**
- declared: normal / 3문장 / writing · CEFR A2~B1(추정) · scores 65/w65/s65
- errors: 시제(am/was) · 관사(a/the) · 맥락어누락(with my team·today) · 강조부사(really) · 동사구조(hard to fix→struggling with)
- **★ bottleneck: writing 첫시도 85~100인데 speaking은 0·20·60 붕괴 = 즉각 산출 병목**

**④ engagement**
- 173일 · streak 2/1 · 저녁~밤 작성 多 · 일기·연습 산발 · source=other · state=active

### 5.2 하늬 (실유저 B · 일기 218 / 연습 572 / 280일)

**① content**
- interests: 음식 0.95(곱창·닭발·백숙·전어·스시, "다이어트엔 쥐약") / 술·바문화 0.85(단골 바·칵테일) / 프리다이빙 0.8(7m 덕다이브) / 헬스 0.7
- people: 파트너(자주 등장), 가족(엄마·오빠·조카), 동료·지인
- life_context: 직장인(자율복장·임직원 이벤트) + 자격증·영어공부

**② voice**
- register: 친근 구어, 솔직·따뜻 / ending: "~어/~었어"체
- signature: "역시"(역시 맛있었어), "쥐약같아", "땡겨서", "너무 특별했어"
- rhythm: 스토리텔러 — 한 일기에 사건 여러 개 줄줄이
- english_mapping: warm·casual("honestly...lol"), "역시"→"as always"

**③ language_profile**
- declared: easy / 1문장 / speaking · CEFR A1~A2(추정) · scores 64/w66/s63
- **★ bottleneck: 짧은 일상 문장은 안정적, 문장 길이·복잡도에서 정체**
- bookmarked: 실생활 표현 多(34건, 헤비)

**④ engagement**
- 280일 초장기 충성 · friend_referral · **★ 일기 active(218편)·연습 at_risk(last 6-2) → 재참여 타깃**

### 5.3 대비 — 8칸이 전부 다르다

| | 찬중 | 하늬 |
|---|---|---|
| content | 일·창업 중심 | 관계(남친)·취미 중심 |
| voice | "~다"체 punchy | "~어"체 스토리텔러 |
| language | speaking 붕괴(즉각성) | 길이·복잡도 정체 |
| engagement | 산발 active | 일기충성·연습이탈 |

> **결론:** 엔진이 일반 프로필을 찍어내는 게 아니라 **사람마다 다른 걸 뽑는다.** 이것이 "GPT 래핑 아니냐"에 대한 실증적 답 — 검증 가능한 설계를 LLM으로 구현한 것.

---

## 6. 학습문장 전/후 (개념 데모 · 스코프 주의)

dossier를 적용하면 같은 뜻이라도 그 사람다운 영어가 나온다. **단, 아래는 "목표(target)"를 보여주는 개념 데모이고, 실제 구현 스코프는 §8 참조(정답은 지금 안 바꿈).**

| 한국어 (실제 일기) | 전 (현재 앱) | 후 (그 사람 voice) |
|---|---|---|
| [찬중] 힘든 하루를 보냈다**아아아** | I had a really tough day today | Today was rough. Like, really rough. |
| [찬중] 고등어회는 **존맛탱**이었다 | (delicious류) | That mackerel sashimi was straight-up unreal. |
| [하늬] 곱창과 맥주도 맛있게 먹었어 | I really enjoyed the grilled intestine and beer too | The grilled intestines and beer were so good, **as always**. |

**결정적 증거:** 같은 "오늘 맛있는 거 먹었어" → 전(둘 다 "I ate something delicious today")은 구분 불가, 후(찬중 "seriously good food" / 하늬 "so good, honestly the best lol")는 즉시 구분됨. = 오차(자기 증발) 제거.

---

## 7. 제품 적용 — 유저 대면 페르소나 대시보드

dossier(내부 추출물)를 **그대로 유저 화면으로** surface. 엔진 하나가 내부 학습용 + 유저 리텐션용 둘 다.

- **구성:** ① content(키워드·인물) · ② voice(말투·입버릇) · 감정 흐름 · "너다운 영어 한 줄"(킬러)
- **게이팅:** 주당 일기 7편 이상 작성 시 해금 → 신호 확보 + 습관 형성
- **주간 swipe:** 주차별 카드를 좌우 스와이프 → 시간 누적이 보여 "내 기록이 나의 일부"라는 애착 루프 시각화
- **친절한 거울:** ③ 약점 점수·④ 이탈위험은 **숨김**(학습에만 내부 사용), 성장으로만 프레임("말하기 순발력 키우는 중")
- **Wrapped과 차별:** 순수 자랑이 아니라 **페르소나를 학습에 연결**("이게 너라서 너의 영어는 이렇게"). 특히 하늬처럼 "일기충성·연습이탈" 유저 재참여에 유효.

---

## 8. 백엔드 구현 맵 (개발용) + 스코프 결정

### 8.1 dossier가 꽂히는 지점 (`src/config/openai.config.ts`)
| 메서드 | 현재 | dossier 연결 |
|---|---|---|
| `generateKoreanSentencesViaOpenAI` (L934) | difficulty 단어수만 | ③ level + ① 소재 |
| `generateAnswerViaOpenAI` (L1095) | "20년 산 원어민" 1종, 슬롯구조(#역할/#규칙/#입력문) | (나중) 변종 슬롯 |
| `scoreViaOpenAI` (L1440) | myAnswer vs rightAnswer | 변경 없음 |
| `feedbackViaOpenAI` (L1466) | myAnswer vs rightAnswer | 변경 없음 |

### 8.2 ★ 스코프 결정 (중요)
- **지금:** dossier **도출만**. `generateAnswerViaOpenAI` 안 건드림 → **정답 안정 유지.**
- **나중:** 정답 개인화 = free-form voice ❌ → **변종(variety) 모델 ⭕** (서부영어/동부영어/영국영어 등 **유한 enum**).
  - 이유: free-form voice는 정답 무한대 → eval 붕괴. variety는 유한 → **변종별 golden-set로 테스트 가능**·유저 설명 가능.
  - 자리: `User_Learning_Settings`에 `english_variety` 세팅 + `generateAnswerViaOpenAI(korean, mode, variety)`.
- **voice 축은 정답 rewriting에 안 씀** — 대시보드 표시 + (나중) variety 추천 신호로만.

### 8.3 eval 영향 (`ops/eval/golden-set-v0.md`)
- golden-set은 KR→고정 정답 1개(정확일치). 변종이 들어오면 **변종별 컬럼**으로 확장하면 그대로 유효.
- 케이스 type 라벨(opener/tense/nominalization/emphasis-test)은 **불변식 검사** → 개인화·변종과 무관하게 살아남음. **이게 voice/변종 시대 eval의 뼈대.**
- 부수: `generateAnswerViaOpenAI`·`scoreViaOpenAI` 모두 `temperature:1` → 채점은 temp 0~0.2로 내려 노이즈(±2~7) 제거 선결.

### 8.4 데이터 갭 (선결)
- **`Practice_Results`에 `error_tags` 컬럼 없음** → ③ language_profile의 오류패턴 구조화 저장하려면 추가 필요. persona-analyzer가 `ai_feedback` 생성 시 5패턴(opener·시제·명사화·강조·형식)으로 태깅해 저장.

---

## 9. 결정 로그 / 다음 단계

**결정**
1. 본질(컨텍스트 관리) = 페르소나 dossier 추출로 구현.
2. dossier = 4축(content/voice/language/engagement), 엔진 단일 진입점, diff 갱신.
3. **지금은 도출만. 정답은 안 바꿈.**
4. 정답 개인화는 나중에 **변종(variety) 모델**로 (free-form voice 폐기).
5. voice는 대시보드·추천용, 정답 rewriting 금지.

**다음 (택1)**
- **A.** dossier 도출 결과 → 유저 **주간 대시보드**(찬중·하늬 2개 = PoC 데모)
- **B.** persona-analyzer **추출 파이프라인 스펙**(입력쿼리 → LLM프롬프트 → dossier JSON, 개발 착수용)

**백로그**
- `error_tags` 스키마 추가 · 사진 vision 활성화(M1) · 변종 모델 설계 · eval 불변식화 · "정답 1개→의도 보존" 재설계

---

## 부록 A. dossier 4축 JSON 스키마
```
content {
  interests: [{ topic, confidence(0~1), source(declared|behavioral|semantic), evidence[diary_id], frequency, last_seen }]
  people:    [{ label, role, salience(0~1), evidence[] }]
  life_context: { occupation, life_stage, locations[], current_focus }
  activities: [{ name, frequency }]
  desires:   [string]   // 민감 → 내부용
}
voice {
  register, ending_style, sentence_rhythm, signature_phrases[], emotion_style, humor_style,
  english_mapping { hedge_handling, sentence_length, slang_treatment, tone_target }
}   // 대시보드/변종추천용, 정답 rewriting 미사용
language_profile {
  declared { difficulty, sentences_count, mode }, estimated_cefr, scores { overall, writing, speaking },
  error_patterns [{ type(opener|tense|nominalization|emphasis|format), count, trend, examples[] }],
  bottleneck, mode_gap, bookmarked_targets[]
}
engagement {
  tenure_days, streaks { visit, learning }, cadence { active_hours[], entries_per_week },
  habit_profile { diary_habit, practice_habit }, persistence, motivation { is_paid, acquisition_source },
  state(active|dormant|at_risk), best_window
}
```

## 부록 B. 검증 데이터 규모
- 찬중 (대표 본인): 일기 26 · 연습 105 · 북마크 2 · 173일
- 하늬 (실유저 B): 일기 218 · 연습 572 · 북마크 34 · 280일
- 추출은 SQL 단일 쿼리(section/event_at/payload-JSON 정규화)로 CSV 내보내 처리.
