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

// 데이터 레지던시: MIXPANEL_API_HOST 가 있으면 그것만, 없으면 US→EU→인도 순으로 시도.
// (EU/인도 프로젝트를 US 주소로 호출하면 403 이 나기 때문에 자동 폴백)
const HOSTS = process.env.MIXPANEL_API_HOST
  ? [process.env.MIXPANEL_API_HOST]
  : ["https://mixpanel.com", "https://eu.mixpanel.com", "https://in.mixpanel.com"];
let workingHost = null; // 한 번 성공하면 그 리전을 캐시

const ONBOARDING_FUNNEL_ID = process.env.MIXPANEL_ONBOARDING_FUNNEL_ID || "87198134";
const PAYWALL_FUNNEL_ID = process.env.MIXPANEL_PAYWALL_FUNNEL_ID || "";

function authHeader() {
  const user = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME;
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  if (!user || !secret) return null;
  return "Basic " + Buffer.from(`${user}:${secret}`).toString("base64");
}

export function isLiveConfigured() {
  // 플랜이 Query API를 막고 있어 기본은 내장 실데이터(스냅샷) 사용.
  // Mixpanel 플랜을 올려 Query API가 열리면 MIXPANEL_QUERY_API_ENABLED=true 로 라이브 전환.
  return Boolean(
    authHeader() && PROJECT_ID && process.env.MIXPANEL_QUERY_API_ENABLED === "true"
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildUrl(host, path, params) {
  const url = new URL(`${host}${path}`);
  url.searchParams.set("project_id", String(PROJECT_ID));
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url;
}

async function query(path, params) {
  const hosts = workingHost ? [workingHost] : HOSTS;
  let authError = null;

  for (const host of hosts) {
    const res = await fetch(buildUrl(host, path, params), {
      headers: { Authorization: authHeader(), Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      workingHost = host; // 성공 리전 기억
      return res.json();
    }
    const body = await res.text();
    // 401/403 은 "이 리전 아님 / 권한 문제" → 다음 리전 시도
    if (res.status === 401 || res.status === 403) {
      authError = `Mixpanel ${path} → ${res.status} (${host}): ${body.slice(0, 160)}`;
      continue;
    }
    // 그 외 에러(400 등)는 바로 던짐
    throw new Error(`Mixpanel ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }

  // 모든 리전이 401/403 → 레지던시가 아니라 Service Account 권한 문제일 가능성
  throw new Error(
    `${authError} · 모든 리전 거부 → Service Account가 이 프로젝트(${PROJECT_ID}) 접근 권한이 있는지(Analyst+), 키가 정확한지 확인 필요`
  );
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
    born_event: seg.born || RETENTION_BORN, // 시리즈별 born 덮어쓰기(예: 학습 완주자)
    event: RETENTION_RETURN,
    unit: "day",
    interval_count: RETENTION_MAX_DAY,
    retention_type: "birth",
  };
  // 신규유저 필터: first_open_date 가 기간 시작일 이후 + 세그먼트 where 결합
  const newUserWhere = `(user["first_open_date"] > "${fromDate}")`;
  params.selector = seg.where ? `${newUserWhere} and (${seg.where})` : newUserWhere;
  const json = await query("/api/2.0/retention", params);
  const { cohortSize, rates } = averageCurve(json);
  return { name: seg.name, cohortSize, rates, small: Boolean(seg.small) };
}

/**
 * 한 차원의 D1~D30 리텐션 곡선들을 반환.
 * @param {string} dimKey
 * @param {number} [days] 신규유저 기간(first_open_date 최근 N일). 기본 30.
 */
export async function getRetentionDimension(dimKey, days = 30) {
  const fromDate = daysAgo(days);

  if (!isLiveConfigured()) {
    const snap =
      snapshot.retention.dimensions[dimKey] || snapshot.retention.dimensions.overall;
    return {
      source: "snapshot",
      dimension: dimKey,
      label: snap.label,
      maxDay: RETENTION_MAX_DAY,
      days,
      note: snapshot.retention.note,
      // 스냅샷은 최근 30일 기준만 보유 → 다른 기간 선택 시 안내
      rangeNote:
        days !== (snapshot.dateRangeDays || 30)
          ? `※ 내장 실데이터는 최근 30일 기준입니다. ${days}일 기준은 라이브(플랜) 연동 시 제공됩니다.`
          : "",
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
    days,
    note: RETENTION_NOTE,
    series,
  };
}

/**
 * 상태배지용 메타데이터 (source/생성일).
 */
export async function getMeta() {
  return {
    source: isLiveConfigured() ? "live" : "snapshot",
    generatedAt: snapshot.generatedAt,
  };
}

/**
 * 하단 인사이트(국가별 리텐션 × 결제율) 데이터.
 * 현재는 내장 실데이터(MCP 추출) 사용.
 */
export async function getInsight() {
  return snapshot.insight;
}

export { HOSTS };
