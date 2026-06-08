# 🌳 LanguageForest 그로스 대시보드

전장상황(LTV / CAC / LTV·CAC)을 한눈에 보기 위한 웹 대시보드.
**Phase 1 — Mixpanel 퍼널 / 리텐션**부터 시작한다.

## 로드맵

```
Phase 1 ▶ Mixpanel 퍼널·리텐션          ← 현재 (이 코드)
Phase 2   RevenueCat 매출·LTV
Phase 3   AppsFlyer 광고비·CAC → LTV/CAC 완성
Phase 4   GA4 보조 지표
```

## 무엇을 보여주나 (Phase 1)

- **KPI**: 온보딩 완료율, 활성화율, 페이월 결제전환, 1주 리텐션
- **온보딩 → 활성화 퍼널**: 시작화면 → 온보딩 완료 → 첫 연습
- **페이월 → 결제 퍼널**: 유입 채널(`acquisition_source`)별로 전환
- **리텐션**: 구독 여부(`is_subscribed`)별 주간 잔존 히트맵
- **매출 베이스라인**: ARPU / ARPPU / 결제전환율 (Slack 공유 수치, 참고용)

## 데이터 소스

키가 없으면 `data/snapshot.json`의 **실데이터 스냅샷**(Mixpanel LanguageForest,
프로젝트 `3848333`, 최근 30일)으로 동작한다. `.env`에 Service Account 키를 넣으면
라이브 연동으로 전환된다(`lib/mixpanel.js`의 TODO 참고).

> ⚠️ 설계 원칙: 모든 지표의 "정의"는 `lib/queries.js` 한 곳에 둔다.
> (MySQL·Firebase·Mixpanel DAU가 서로 안 맞던 문제의 재발 방지)

## 실행

```bash
cd growth-dashboard
npm install
cp .env.example .env   # (선택) Mixpanel 키 입력
npm run dev            # http://localhost:3000
```

## 라이브 연동 (Phase 1.1)

1. Mixpanel → Organization Settings → Service Accounts 에서 키 발급
2. `.env`에 `MIXPANEL_SERVICE_ACCOUNT_USERNAME` / `_SECRET` 입력
3. `lib/mixpanel.js`의 `getDashboardData()` TODO 부분에 Query API 변환 로직 구현

## 스택

Next.js 14 (App Router) · React 18 · Tailwind CSS
