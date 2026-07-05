# 핸드오프 — RevenueCat 연결 & KPI 분석 이어가기

> 이 문서는 **새 클라우드 세션**에서 작업을 이어받기 위한 브리핑입니다.
> 이전 세션에서 네트워크 정책(Trusted)이 `api.revenuecat.com`을 막아 RevenueCat 연결에 실패 → 새 세션(Custom 허용)에서 재개.

## 0. 새 세션이 시작하면 할 일 (요약)
1. 네트워크에 RevenueCat이 열렸는지 확인: `curl -sS -o /dev/null -w "%{http_code}\n" https://api.revenuecat.com/v1/subscribers/probe` → 401이면 OK(도달됨), 403이면 아직 정책 미적용.
2. 사용자에게 **RevenueCat Secret API Key** 요청 (대시보드 → Project settings → API keys → Secret).
3. RevenueCat에서 **테스트(sandbox) 제외** 프로덕션 지표 확보 → 아래 Mixpanel 수치를 검증/교체.

## 1. 사업 맥락 (언어의숲)
- AI 언어학습 앱, B2C 구독. 재미교포 중심 → 북미 한국어학습자 확장 예정.
- BM: 현재 구독 / 리텐션 오르면 무료기반 F2P(광고+마이크로페이먼트) 전환 예정.
- 병목: 비즈니스 지표 정체, "왜 결제하는지 내부적으로도 모름", 마케팅/GTM 약함(메타 광고 60% 의존).
- 런웨이 ~1년, 시드/팁스 의향. 7/16 클로즈드 IR 예정.

## 2. 확정된 KPI 체계 (docs/언어의숲_KPI체계.md 참조)
- **북극성: LTV/CAC**
- LTV: ARPPU · 결제전환율 · 재구매율(구독유지율)
- CAC: CAC · CPI · ROAS · K-Factor · 오가닉 비율
- 리텐션: 유료 D7 · 무료 D7 · Stickiness(DAU/WAU) · 유료/무료 스트릭

## 3. Mixpanel에서 이미 뽑은 값 (project 3848333, LanguageForest)
> 행동/리텐션 지표는 신뢰. **결제 건수/매출은 테스트 데이터 오염 → RevenueCat으로 교체 필요.**

**리텐션 (app_open 코호트):**
- 유료(현재 구독 기준) D7 ~34%, D30 ~29% / 무료 D7 ~5%, D30 ~1%
- **"당시 유료"(subscription_purchased_at < 주 시작) 기준 주간 D7 = 40~53%** (생존편향 제거해도 무료 대비 ~6배). 무료 D7 6~9%.
- Stickiness(DAU/WAU) ~0.2, 활성유저(30d) 1,611, 활성 구독자 57.
- 획득 소스: instagram_ad 60%(메타 의존), 오가닉 ~15%.

**결제 (⚠️ 테스트 오염, 상한선):**
- Mixpanel `subscription_purchase_completed`: YTD ~215건, 월별 1월 피크(134건/₩8.1M) → 4월 저점(14건/₩0.4M), 약 20배 시즌성.
- ARPPU(YTD) ₩69,103, 플랜믹스 연간권 ~65%(정가82,500/할인58,500), 월간 25%.
- **테스트 흔적**: 유저당 결제 7회×3명·5회·4회 반복 다수 / 콜론형 product_id(`00001:00005` 등 58건). → 실제보다 부풀려짐.

## 4. RevenueCat으로 확인/교체할 지표
- 실 **결제 건수·순매출**(sandbox 제외, 스토어 수수료 반영)
- **MRR, 활성 구독자 수**
- **재구매율/갱신율/churn, 구독 수명(Lifetime)** ← 결제 이벤트로는 불가, RevenueCat 필수
- 특히 **1월 연간권 코호트의 내년 갱신 리스크**(미팅서 12개월 해지율 70% 언급)

### RevenueCat API 참고
- v1 `GET /v1/subscribers/{app_user_id}` (Bearer=Secret key): 고객 단위.
- v2 `GET /v2/projects/{project_id}/customers` 등: 목록/구독(페이지네이션).
- 헤드라인 지표(MRR/활성/매출)는 대시보드 Overview 또는 Scheduled Data Export(CSV, is_sandbox 플래그로 테스트 제외)가 가장 깔끔 → 연결 후 사용자와 최적 경로 확정.

## 5. 산출물
- 노션 KPI 페이지: https://app.notion.com/p/39373a0d87a081c591c6cbda9145e94e
- 주간 리텐션 대시보드(Artifact): https://claude.ai/code/artifact/f558a895-66cd-4414-83c3-10149be41468
- 후보 AC 7곳: 스파크랩/본엔젤스/매쉬업엔젤스/카카오벤처스/스트롱벤처스/블루포인트파트너스/소풍벤처스 (포폴 경쟁사 대조 미완)

## 6. 남은 To-do
- [ ] RevenueCat 연결 → 결제/매출/재구매율 실측치로 교체
- [ ] 대시보드에 매출 패널(월매출·플랜믹스·ARPPU·MRR) 추가
- [ ] 각 KPI 현재값 → 연말 목표값 설정
- [ ] AC 7곳 포트폴리오 경쟁사 대조표
- [ ] 주간 자동 리포트 파이프라인(Mixpanel+RevenueCat+Meta → 대시보드)
