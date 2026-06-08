// ─────────────────────────────────────────────────────────────
// Mixpanel 커넥터
//
// 동작 방식:
//  - Service Account 키가 .env 에 있으면 → Mixpanel Query API 라이브 호출
//  - 키가 없거나 호출 실패 시 → data/snapshot.json 의 실데이터로 (섹션별) 폴백
//
// 라이브로 가져오는 것:
//  - 온보딩 퍼널: 저장된 funnel_id (기본 87198134 "온보딩 전환율")
//  - 리텐션: onboarding_completed → app_open, 구독 여부(is_subscribed)별
//  - 페이월 퍼널: 저장된 funnel_id 가 .env 에 있으면 라이브, 없으면 스냅샷
//
// 인증: Service Account → Basic base64(username:secret)
// 데이터 레지던시: 기본 US(mixpanel.com). EU 프로젝트면 MIXPANEL_API_HOST 변경.
// ─────────────────────────────────────────────────────────────

import snapshot from "@/data/snapshot.json";
import { PROJECT_ID } from "@/lib/queries";

const API_HOST = process.env.MIXPANEL_API_HOST || "https://mixpanel.com";
const ONBOARDING_FUNNEL_ID = process.env.MIXPANEL_ONBOARDING_FUNNEL_ID || "87198134";
const PAYWALL_FUNNEL_ID = process.env.MIXPANEL_PAYWALL_FUNNEL_ID || "";

function authHeader() {
  const user = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME;
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  if (!user || !secret) return null;
  return "Basic " + Buffer.from(`${user}:${secret}`).toString("base64");
}

export function isLiveConfigured() {
  return Boolean(authHeader() && PROJECT_ID);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from_date: fmt(from), to_date: fmt(to) };
}

async function query(path, params) {
  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("project_id", String(PROJECT_ID));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    next: { revalidate: 3600 }, // 1시간 캐시 (API 한도 보호)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mixpanel ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// 저장된 퍼널을 가져와 단계 인덱스별 count 합계로 집계한다.
// (날짜 버킷이 여러 개면 합산 → 기간 전체 단계별 전환 수)
async function fetchFunnelCounts(funnelId, days) {
  const { from_date, to_date } = dateRange(days);
  const json = await query("/api/2.0/funnels", { funnel_id: funnelId, from_date, to_date });
  const totals = [];
  for (const date of Object.keys(json.data || {})) {
    const bucket = json.data[date] || {};
    const steps = bucket.steps || bucket.$overall || [];
    steps.forEach((s, i) => {
      totals[i] = (totals[i] || 0) + (s.count || 0);
    });
  }
  return totals; // [step0Count, step1Count, ...]
}

// 리텐션: 코호트들을 가중 평균해 하나의 곡선으로.
async function fetchRetentionSeries(bornEvent, returnEvent, { days, where } = {}) {
  const { from_date, to_date } = dateRange(days);
  const json = await query("/api/2.0/retention", {
    from_date,
    to_date,
    born_event: bornEvent,
    event: returnEvent,
    unit: "week",
    interval_count: 8,
    retention_type: "birth",
    where,
  });
  const cohorts = Object.values(json).filter((c) => c && Array.isArray(c.counts));
  if (!cohorts.length) return null;

  const maxLen = Math.max(...cohorts.map((c) => c.counts.length));
  const rates = [];
  for (let i = 0; i < maxLen; i++) {
    let num = 0;
    let den = 0;
    for (const c of cohorts) {
      if (c.counts[i] !== undefined) {
        num += c.counts[i];
        den += c.first || 0;
      }
    }
    rates[i] = den ? num / den : 0;
  }
  const cohortSize = cohorts.reduce((a, c) => a + (c.first || 0), 0);
  return { cohortSize, rates };
}

/**
 * 대시보드 데이터 반환. 라이브 키가 있으면 Query API에서 가져오고,
 * 섹션별로 실패하면 스냅샷으로 폴백한다.
 */
export async function getDashboardData() {
  if (!isLiveConfigured()) {
    return { source: "snapshot", ...snapshot };
  }

  const days = snapshot.dateRangeDays || 30;
  const result = {
    source: "live",
    generatedAt: today(),
    dateRangeDays: days,
    funnels: structuredClone(snapshot.funnels),
    retention: structuredClone(snapshot.retention),
    baseline: snapshot.baseline,
    partial: false,
  };

  // 1) 온보딩 퍼널 (라벨은 정의값 유지, count만 라이브로 교체)
  try {
    const counts = await fetchFunnelCounts(ONBOARDING_FUNNEL_ID, days);
    if (counts.length) {
      result.funnels.onboarding.steps = result.funnels.onboarding.steps.map((s, i) => ({
        ...s,
        count: counts[i] ?? s.count,
      }));
    }
  } catch (e) {
    console.warn("[mixpanel] 온보딩 퍼널 라이브 실패 → 스냅샷:", e.message);
    result.partial = true;
  }

  // 2) 페이월 퍼널 (저장된 funnel_id 가 설정된 경우에만 라이브)
  if (PAYWALL_FUNNEL_ID) {
    try {
      const counts = await fetchFunnelCounts(PAYWALL_FUNNEL_ID, days);
      if (counts.length) {
        result.funnels.paywall.overall = result.funnels.paywall.overall.map((s, i) => ({
          ...s,
          count: counts[i] ?? s.count,
        }));
      }
    } catch (e) {
      console.warn("[mixpanel] 페이월 퍼널 라이브 실패 → 스냅샷:", e.message);
      result.partial = true;
    }
  } else {
    // 저장된 페이월 퍼널이 없으면 채널별 분해는 스냅샷 유지
    result.partial = true;
  }

  // 3) 리텐션 (구독 여부별)
  try {
    const [overall, sub, nonsub] = await Promise.all([
      fetchRetentionSeries("onboarding_completed", "app_open", { days: 56 }),
      fetchRetentionSeries("onboarding_completed", "app_open", {
        days: 56,
        where: 'properties["is_subscribed"]==true',
      }),
      fetchRetentionSeries("onboarding_completed", "app_open", {
        days: 56,
        where: 'properties["is_subscribed"]==false',
      }),
    ]);

    const series = {};
    if (overall) series["전체"] = overall;
    if (sub) series["구독자"] = sub;
    if (nonsub) series["비구독"] = nonsub;

    if (Object.keys(series).length) {
      const len = (overall || sub || nonsub).rates.length;
      result.retention.series = series;
      result.retention.periods = Array.from({ length: len }, (_, i) => `W${i}`);
    }
  } catch (e) {
    console.warn("[mixpanel] 리텐션 라이브 실패 → 스냅샷:", e.message);
    result.partial = true;
  }

  return result;
}

export { API_HOST };
