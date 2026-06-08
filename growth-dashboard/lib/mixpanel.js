// ─────────────────────────────────────────────────────────────
// Mixpanel 커넥터
//
//  - Service Account 키가 .env 에 있으면 → Mixpanel Query API 라이브 호출
//  - 키가 없거나 호출 실패 시 → data/snapshot.json 으로 (섹션별) 폴백
//
// 퍼널: 저장된 funnel_id (getDashboardData)
// 리텐션: 가입 → 앱오픈, 차원별 D1~D30 곡선 (getRetentionDimension)
//
// 인증: Service Account → Basic base64(username:secret)
// 레지던시: 기본 US(mixpanel.com). EU면 MIXPANEL_API_HOST 변경.
// ─────────────────────────────────────────────────────────────

import snapshot from "@/data/snapshot.json";
import {
  PROJECT_ID,
  RETENTION_BORN,
  RETENTION_RETURN,
  RETENTION_MAX_DAY,
  RETENTION_NOTE,
  RETENTION_DIMENSIONS,
} from "@/lib/queries";

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

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function query(path, params) {
  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("project_id", String(PROJECT_ID));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mixpanel ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── 퍼널 ──────────────────────────────────────────────────────
async function fetchFunnelCounts(funnelId, days) {
  const json = await query("/api/2.0/funnels", {
    funnel_id: funnelId,
    from_date: daysAgo(days),
    to_date: today(),
  });
  const totals = [];
  for (const date of Object.keys(json.data || {})) {
    const bucket = json.data[date] || {};
    const steps = bucket.steps || bucket.$overall || [];
    steps.forEach((s, i) => {
      totals[i] = (totals[i] || 0) + (s.count || 0);
    });
  }
  return totals;
}

// ── 리텐션 ────────────────────────────────────────────────────
// 코호트들을 가중 평균해 하나의 곡선(rates[0..maxDay])과 코호트 크기로.
function averageCurve(json) {
  const cohorts = Object.values(json).filter((c) => c && Array.isArray(c.counts));
  if (!cohorts.length) return { cohortSize: 0, rates: [] };
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

async function fetchSeriesCurve(seg, fromDate) {
  const params = {
    from_date: fromDate,
    to_date: today(),
    born_event: RETENTION_BORN,
    event: RETENTION_RETURN,
    unit: "day",
    interval_count: RETENTION_MAX_DAY,
    retention_type: "birth",
  };
  if (seg.where) params.born_where = seg.where;
  if (seg.cohortIdEnv && process.env[seg.cohortIdEnv]) {
    params.filter_by_cohort = JSON.stringify({ id: Number(process.env[seg.cohortIdEnv]) });
  }
  const json = await query("/api/2.0/retention", params);
  const { cohortSize, rates } = averageCurve(json);
  return { name: seg.name, cohortSize, rates, small: Boolean(seg.small) };
}

/**
 * 한 차원(전체/국가/성별/나이/결제/활성화)의 D1~D30 리텐션 곡선들을 반환.
 * @param {string} dimKey
 * @param {string} [since] 가입일 시작(YYYY-MM-DD). 없으면 최근 90일.
 */
export async function getRetentionDimension(dimKey, since) {
  const fromDate = since || daysAgo(90);

  if (!isLiveConfigured()) {
    const snap =
      snapshot.retention.dimensions[dimKey] || snapshot.retention.dimensions.overall;
    return {
      source: "snapshot",
      dimension: dimKey,
      label: snap.label,
      maxDay: RETENTION_MAX_DAY,
      since: fromDate,
      note: snapshot.retention.note,
      liveOnly: Boolean(snap.liveOnly),
      series: snap.series,
    };
  }

  const dim = RETENTION_DIMENSIONS[dimKey] || RETENTION_DIMENSIONS.overall;
  const series = [];
  for (const seg of dim.series) {
    // 활성 유저는 행동 코호트 ID가 있어야 함
    if (seg.cohortIdEnv && !process.env[seg.cohortIdEnv]) {
      series.push({
        name: seg.name,
        cohortSize: 0,
        rates: [],
        unavailable: true,
        reason: "활성 코호트 미설정 (MIXPANEL_ACTIVE_COHORT_ID)",
      });
      continue;
    }
    try {
      series.push(await fetchSeriesCurve(seg, fromDate));
    } catch (e) {
      console.warn(`[mixpanel] 리텐션(${dimKey}/${seg.name}) 실패:`, e.message);
      series.push({ name: seg.name, cohortSize: 0, rates: [], unavailable: true, reason: e.message });
    }
  }

  return {
    source: "live",
    dimension: dimKey,
    label: dim.label,
    maxDay: RETENTION_MAX_DAY,
    since: fromDate,
    note: RETENTION_NOTE,
    series,
  };
}

/**
 * 퍼널 + 상태배지용 데이터. 리텐션은 getRetentionDimension 에서 별도 처리.
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
    partial: false,
  };

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
    result.partial = true;
  }

  return result;
}

export { API_HOST };
