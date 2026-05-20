# 산출물 3 — Key Metrics 정의 & 측정 이벤트

## 곱셈 공식 (북극성 → 매출)

```
노출 × 다운로드CVR × 가입CVR × 온보딩완료율 × Activation율 × 결제CVR × 평균플랜단가 = 일 매출
                                                                  × 재구매율           = MRR
```

## 화면별 측정 이벤트 (실제 앱 화면 기반)

### Acquisition (온보딩 7화면)

| 화면 | 이벤트 (제안) | 속성 | 측정 목적 |
|---|---|---|---|
| [1] 로그인 | `signup_start` | — | 페이지 진입 |
| [1] 로그인 | `signup_complete` | `method=google/apple` | 가입 방법별 CVR |
| [2] 닉네임 | `nickname_set` | `used_ai_suggestion=bool` | AI 추천 사용률 |
| [3] 생년 | `birthyear_set` | `year` | 연령대 분포 |
| [4] 성별 | `gender_set` | `gender` | 페르소나 검증 (사업계획서: 여성 비율) |
| [5] **어트리뷰션** ★ | `attribution_self_report` | `channel` | **셀프 채널 효과 측정 — 광고 어트리뷰션 SDK 없이도 거칠게 추적** |
| [6] 관심사 | `interest_select` | `tag` | 인기 관심사 → 콘텐츠 개발 |
| [6] 관심사 | `interest_complete` | `count` | 5개 미만 = 이탈 |
| [7] 알림 권한 | `push_permission` | `granted=bool` | D1 리텐션 선행지표 |
| 전체 | `onboarding_complete` | `duration_sec` | 온보딩 완료율 |

### Activation (학습 세션 9화면)

| 화면 | 이벤트 | 속성 | 측정 목적 |
|---|---|---|---|
| [1] 학습홈 | `home_view` | — | DAU 기초 |
| [2] 일기작성 | `diary_create` | `word_count`, `has_photo` | 첫 일기 작성률 |
| [3] AI처리 | `ai_processing_start` | — | 로딩 시간 측정 |
| [4] 문장노출 | `expression_view` | `expression_id` | 콘텐츠 노출 |
| [5] 학습시작 | `study_start` ★ | — | **일기→학습 전환율 (핵심 누수)** |
| [6] 인출입력 | `retrieval_submit` | `mode=voice/text`, `attempt_count` | 인출 모드 선호 |
| [7] 피드백처리 | `feedback_processing_start` | — | — |
| [8] 점수 | `feedback_view` | `score` | 점수 분포 → 저점수 이탈 가설 |
| [9] **WoW** ★ | `study_complete` ★ | `is_first` | **NorthStar 후보: 첫 학습 완료** |

### Revenue (페이월 5화면)

| 화면 | 이벤트 | 속성 | 측정 목적 |
|---|---|---|---|
| [1] 페이월 | `paywall_view` | `trigger=wow/limit/manual` | 페이월 트리거별 효과 |
| [2] 플랜선택 | `plan_select` | `plan=1y/6m/1m` | **평균 플랜 단가 분해** |
| [3] 결제모달 | `purchase_modal_view` | — | 결제 의향 |
| [4] 결제완료 | `purchase` | `plan`, `amount`, `currency` | 매출 |
| [5] 환영화면 | `welcome_view` | `from_referral=bool` | 추천 유입 결제 비율 |

### Referral (2화면 + 가설)

| 위치 | 이벤트 | 속성 | 측정 목적 |
|---|---|---|---|
| 코드 입력 | `invite_code_redeem` | `code`, `valid=bool` | K-factor 받는 쪽 |
| 결과 공유 (가설) | `result_share` | `platform=instagram/threads/etc` | K-factor 보내는 쪽 |
| 환영화면 | `welcome_view` | `bonus_applied=bool` | 추천 보너스 적용률 |

### Retention

| 트리거 | 이벤트 | 속성 | 측정 목적 |
|---|---|---|---|
| 푸시 | `push_open` | `type=daily/streak/social` | 푸시 효과 |
| 재방문 | `dau_revisit` | `day_since_install` | D1/D7/D30 코호트 |
| 연속학습 | `streak_extend` | `streak_count` | 습관화 깊이 |
| 정서시각화 | `emotion_viz_view` | `period=week/month/quarter` | 효능감 자극 빈도 |

## 파생 지표 (스프레드시트)

| 지표 | 공식 | 현재값 | 목표(27) | 목표(28) | 비고 |
|---|---|---|---|---|---|
| 가입CVR | 가입 / 다운로드 | ? | — | — | **누락 — 수집 시작** |
| 온보딩완료율 | 온보딩완료 / 가입 | ? | — | — | **누락 — 수집 시작** |
| 알림동의율 | 푸시동의 / 온보딩완료 | ? | — | — | D1 +27%p 선행 |
| Activation율 | 첫학습완료 / 온보딩완료 | ? | — | — | NorthStar 후보 |
| D1 접속 리텐션 | (D+1 접속) / D0 | 30% | 40% | 50% | |
| D1 완료 리텐션 | (D+1 학습완료) / D0 | 39% | 50% | 65% | |
| D7 리텐션 | (D+7 접속) / D0 | 14% | 22% | 35% | |
| D30 부활률 | 부활 / 이탈 | 2% | 3% | 5% | 가장 큰 누수 |
| 페이월 클릭CVR | 클릭 / 노출 | ? | — | — | **누락** |
| 결제전환율 | 첫구매 / 가입 | 1.8% | 3.5% | 4.5% | |
| 평균 플랜 단가 | Σ(플랜가) / 결제건수 | ? | — | — | ARPPU 핵심 |
| 재구매율 | 재구매 / 첫구매 | 20% | 30% | 40% | |
| ARPPU | 매출 / 결제자 | 55,292원 | — | — | |
| ARPU | 매출 / 전체유저 | 1,887원 | — | — | |
| CPI | 광고비 / 설치 | 529원 | 450 | 350 | |
| CAC | CPI / 결제CVR / (1+K) | 18,623원 | 16,000 | 15,600 | |
| LTV | ARPPU × 1/(1-재구매율) | 88,020원 | 110,000 | 183,000 | |
| LTV/CAC | LTV ÷ CAC | 4.73 | 6.9 | 12.5 | 2027Q2 BEP |
| K-factor | 추천유입 / 활성유저 | 0.31 | 0.30 | 0.45 | |
| MRR | 구독자 × ARPPU | 107만원 | 1,590만원 | 1.12억원 | |

## 누락 / 신규 수집 필요 지표

1. **온보딩 7단계 step-by-step 드롭오프** — 어느 화면에서 가장 많이 빠지는지
2. **일기 작성 → 학습 시작 CVR** — Activation 핵심 누수 지점
3. **피드백 점수 분포 × D1 리텐션** — 저점수 이탈 가설
4. **플랜 선택 비율 (1y/6m/1m)** — ARPPU 분해
5. **셀프 어트리뷰션 vs 실제 효율** — 이미 수집 중인 데이터 활용도 점검
6. **알림 동의 vs 미동의 D1 리텐션 격차** — 자사 카피 검증 (27% 차이)
