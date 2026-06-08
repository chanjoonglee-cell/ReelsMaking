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

// ── 리텐션 정의 ───────────────────────────────────────────────
// 리텐션: 앱오픈(app_open) → 홈 체류(home_dwell) 재방문, 일 코호트(on-day) D1~D30.
// (Mixpanel "User Retention" 리포트와 동일 정의)
export const RETENTION_BORN = "$ae_first_open"; // 첫 앱 실행(첫 가입일)
export const RETENTION_RETURN = "app_open"; // 재방문 판정
export const RETENTION_MAX_DAY = 30;
export const RETENTION_NOTE =
  "첫 앱 실행($ae_first_open) → 앱오픈 재방문 · 일 코호트(on-day) · 최근 30일";

// Mixpanel where 표현식 규칙:
//  - 이벤트 속성: properties["..."]   (예: mp_country_code)
//  - 유저 속성:   user["..."]         (예: gender, age, is_subscribed)
// 시리즈별로 born(코호트 진입 이벤트)을 덮어쓸 수 있다(예: 학습 완주자).
export const RETENTION_DIMENSIONS = {
  overall: {
    label: "전체",
    series: [{ name: "전체 유저" }],
  },
  completion: {
    label: "학습 완주여부",
    series: [
      { name: "전체" },
      { name: "🎓 학습 완주자", born: "practice_session_completed" },
    ],
  },
  country: {
    label: "국가별",
    series: [
      { name: "전체" },
      { name: "🇰🇷 한국", where: 'properties["mp_country_code"]=="South Korea"' },
      { name: "🇺🇸 미국", where: 'properties["mp_country_code"]=="United States"' },
    ],
  },
  gender: {
    label: "성별",
    series: [
      { name: "👩 여성", where: 'user["gender"]=="female"' },
      { name: "👨 남성", where: 'user["gender"]=="male"', small: true },
      { name: "기타", where: 'user["gender"]=="other"', small: true },
    ],
  },
  age: {
    label: "나이대 (6세 단위)",
    series: [
      { name: "6–12세", where: 'user["age"]>=6 and user["age"]<12', small: true },
      { name: "12–18세", where: 'user["age"]>=12 and user["age"]<18', small: true },
      { name: "18–24세", where: 'user["age"]>=18 and user["age"]<24' },
      { name: "24–30세", where: 'user["age"]>=24 and user["age"]<30' },
      { name: "30–36세", where: 'user["age"]>=30 and user["age"]<36' },
      { name: "36–42세", where: 'user["age"]>=36 and user["age"]<42' },
      { name: "42–48세", where: 'user["age"]>=42 and user["age"]<48' },
      { name: "48–54세", where: 'user["age"]>=48 and user["age"]<54', small: true },
      { name: "54세+", where: 'user["age"]>=54', small: true },
    ],
  },
  payment: {
    label: "결제 여부",
    series: [
      { name: "💳 결제", where: 'user["is_subscribed"]==true', small: true },
      { name: "비결제", where: 'user["is_subscribed"]==false' },
    ],
  },
};

// UI 드롭다운 순서/라벨
export const RETENTION_DIMENSION_LIST = [
  { key: "overall", label: "전체" },
  { key: "completion", label: "학습 완주여부" },
  { key: "country", label: "국가별" },
  { key: "gender", label: "성별" },
  { key: "age", label: "나이대 (6세 단위)" },
  { key: "payment", label: "결제 여부" },
];

export const COUNTRY_PROPERTY = "mp_country_code";
export const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID || "3848333";
