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

export const RETENTION = {
  id: "retention",
  name: "리텐션 (온보딩 완료 → 재방문)",
  born: "onboarding_completed",
  returning: "app_open",
  unit: "week",
  breakdown: "is_subscribed",
};

// 세그먼트 축으로 쓸 수 있는 Mixpanel 유저 속성
export const SEGMENTS = {
  acquisition_source: { label: "유입 채널" },
  is_subscribed: { label: "구독 여부" },
  subscription_plan: { label: "구독 플랜" },
};

export const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID || "3848333";
