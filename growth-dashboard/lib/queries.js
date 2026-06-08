// ─────────────────────────────────────────────────────────────
// 지표 정의의 단일 진실 소스 (Single Source of Truth)
//
// Slack #data_analysis 에서 "MySQL · Firebase · Mixpanel DAU가 서로 안 맞는다"는
// 문제가 있었다. 그 반복을 막기 위해, 대시보드가 쓰는 모든 퍼널/리텐션/세그먼트의
// "정의"를 여기 한 곳에 둔다. 라이브 커넥터(lib/mixpanel.js)도 이 정의를 따른다.
// ─────────────────────────────────────────────────────────────

export const FUNNELS = {
  onboarding: {
    id: "onboarding",
    name: "온보딩 → 활성화",
    steps: [
      { event: "onboarding_get_started_viewed", label: "온보딩 시작" },
      { event: "onboarding_completed", label: "온보딩 완료" },
      { event: "practice_session_completed", label: "첫 연습 완료(활성화)" },
    ],
    conversionWindowDays: 7,
  },
  paywall: {
    id: "paywall",
    name: "페이월 → 결제",
    steps: [
      { event: "subscription_plans_viewed", label: "플랜 조회" },
      { event: "subscription_purchase_started", label: "결제 시작" },
      { event: "subscription_purchase_completed", label: "결제 완료" },
    ],
    conversionWindowDays: 7,
    breakdown: "acquisition_source",
  },
};

// 리텐션: 초기 행동(born) → 재방문(app_open)을 D1/D7/D30/D90 마일스톤으로.
//  - D1/D7/D30: 일(day) 코호트 (Mixpanel on-day, 일 리텐션 최대 60일)
//  - D90: 월(month) 코호트 M3 (일 단위로는 60일 상한이라 불가)
export const RETENTION = {
  id: "retention",
  name: "리텐션 (재방문)",
  returning: "app_open",
  milestones: [1, 7, 30, 90],
  // 세그먼트별 born 이벤트 / 필터(born_where)
  segments: [
    { group: "전체", name: "전체 유저", born: "onboarding_completed" },
    {
      group: "국가별",
      name: "🇰🇷 한국",
      born: "onboarding_completed",
      bornWhere: 'properties["mp_country_code"]=="South Korea"',
    },
    {
      group: "국가별",
      name: "🇺🇸 미국",
      born: "onboarding_completed",
      bornWhere: 'properties["mp_country_code"]=="United States"',
    },
    {
      group: "결제 여부",
      name: "💳 결제 유저",
      born: "subscription_purchase_completed",
      small: true,
    },
  ],
};

// 국가 코드 속성은 풀네임으로 저장됨 (예: "South Korea", "United States")
export const COUNTRY_PROPERTY = "mp_country_code";

export const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID || "3848333";
