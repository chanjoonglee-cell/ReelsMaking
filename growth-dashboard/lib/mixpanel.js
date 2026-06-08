// ─────────────────────────────────────────────────────────────
// Mixpanel 커넥터
//
// 동작 방식:
//  - Service Account 키가 .env 에 있으면 → Mixpanel Query API 라이브 호출
//  - 키가 없거나 호출 실패 시 → data/snapshot.json 의 실데이터로 (섹션별) 폴백
//
// 라이브로 가져오는 것:
//  - 온보딩 퍼널: 저장된 funnel_id (기본 87198134 "온보딩 전환율")
//  - 리텐션: born → app_open, 세그먼트별 D1/D7/D30(일 코호트) + D90(월 M3)
//  - 페이월 퍼널: 저장된 funnel_id 가 .env 에 있으면 라이브, 없으면 스냅샷
//
// 인증: Service Account → Basic base64(username:secret)
// 데이터 레지던시: 기본 US(mixpanel.com). EU 프로젝트면 MIXPANEL_API_HOST 변경.
// ─────────────────────────────────────────────────────────────

import snapshot from "@/data/snapshot.json";
import { PROJECT_ID, RETENTION } from "@/lib/queries";

const API_HOST = process.env.MIXPANEL_API_HOST || "https://mixpanel.com";
const ONBOARDING_FUNNEL_ID = process.env.MIXPANEL_ONBOARDING_FUNNEL_ID || "87198134";
const PAYWALL_FUNNEL_ID = process.env.MIXPANEL_PAYWALL_FUNNEL_ID || "";
const RETURN_EVENT = RETENTION.returning; // app_open

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

// ── 퍼널 ──────────────────────────────────────────────────────
// 저장된 퍼널을 가져와 단계 인덱스별 count 합계로 집계.
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
  return totals;
}

// ── 리텐션 ────────────────────────────────────────────────────
// 코호트들을 가중 평균해 하나의 곡선(rates)과 코호트 크기로.
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

async function fetchRetentionCurve(bornEvent, { unit, intervalCount, days, bornWhere }) {
  const { from_date, to_date } = dateRange(days);
  const json = await query("/api/2.0/retention", {
    from_date,
    to_date,
    born_event: bornEvent,
    event: RETURN_EVENT,
    unit,
    interval_count: intervalCount,
    retention_type: "birth",
    born_where: bornWhere,
  });
  return averageCurve(json);
}

// 세그먼트 1개의 D1/D7/D30/D90 한 줄을 만든다.
async function fetchRetentionRow(seg) {
  // D1/D7/D30 — 일 코호트 (최근 90일, 일 리텐션 최대 60일)
  const day = await fetchRetentionCurve(seg.born, {
    unit: "day",
    intervalCount: 60,
    days: 90,
    bornWhere: seg.bornWhere,
  });
  // D90 — 월 코호트 M3 (실패해도 무시)
  let d90 = null;
  try {
    const month = await fetchRetentionCurve(seg.born, {
      unit: "month",
      intervalCount: 3,
      days: 150,
      bornWhere: seg.bornWhere,
    });
    d90 = month.rates[3] ?? null;
  } catch {
    /* D90 없으면 — 표시 */
  }
  return {
    name: seg.name,
    group: seg.group,
    cohortSize: day.cohortSize,
    values: [day.rates[1] ?? null, day.rates[7] ?? null, day.rates[30] ?? null, d90],
    small: Boolean(seg.small),
  };
}

// 세그먼트 정의(queries.js)대로 전 세그먼트 리텐션을 가져와 그룹으로 묶는다.
async function fetchRetention() {
  const rows = await Promise.all(RETENTION.segments.map((seg) => fetchRetentionRow(seg)));
  const order = [];
  const byGroup = {};
  for (const row of rows) {
    if (!byGroup[row.group]) {
      byGroup[row.group] = { label: row.group, rows: [] };
      order.push(row.group);
    }
    byGroup[row.group].rows.push(row);
  }
  return {
    milestones: ["D1", "D7", "D30", "D90"],
    note: snapshot.retention.note,
    groups: order.map((g) => byGroup[g]),
  };
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
    partial: false,
  };

  // 1) 온보딩 퍼널 (라벨 유지, count만 라이브로 교체)
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
    result.partial = true; // 채널별 페이월 분해는 스냅샷 유지
  }

  // 3) 리텐션 (세그먼트별 D1/D7/D30/D90)
  try {
    result.retention = await fetchRetention();
  } catch (e) {
    console.warn("[mixpanel] 리텐션 라이브 실패 → 스냅샷:", e.message);
    result.partial = true;
  }

  return result;
}

export { API_HOST };
