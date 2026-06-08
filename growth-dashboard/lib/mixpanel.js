// ─────────────────────────────────────────────────────────────
// Mixpanel 커넥터
//
// 동작 방식:
//  - Service Account 키가 .env 에 있으면 → Mixpanel Query API 라이브 호출 (TODO)
//  - 키가 없으면 → data/snapshot.json 의 실데이터 스냅샷 사용
//
// 스냅샷도 실제 프로젝트(LanguageForest) 데이터다. 최근 30일 기준으로
// 추출해 구워둔 것이라, 키가 없어도 대시보드가 실데이터로 동작한다.
// ─────────────────────────────────────────────────────────────

import snapshot from "@/data/snapshot.json";
import { PROJECT_ID } from "@/lib/queries";

const API_HOST = "https://mixpanel.com/api";

function authHeader() {
  const user = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME;
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
  if (!user || !secret) return null;
  const token = Buffer.from(`${user}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export function isLiveConfigured() {
  return Boolean(authHeader() && PROJECT_ID);
}

/**
 * 대시보드가 필요로 하는 전체 데이터를 반환한다.
 * 반환 형태는 snapshot.json 구조와 동일하며, source 필드로 출처를 구분한다.
 */
export async function getDashboardData() {
  if (!isLiveConfigured()) {
    return { source: "snapshot", ...snapshot };
  }

  // TODO(Phase 1.1) — 라이브 연동:
  //   퍼널:   GET {API_HOST}/2.0/funnels   (저장된 funnel_id 기반) 또는
  //           POST {API_HOST}/query/funnels (Service Account)
  //   리텐션: GET {API_HOST}/2.0/retention
  //   응답을 snapshot.json 과 동일한 형태로 변환해 반환할 것.
  //   인증: headers: { Authorization: authHeader() }, params: { project_id: PROJECT_ID }
  //
  // 아직 변환 로직이 없으므로 안전하게 스냅샷으로 폴백한다.
  return { source: "snapshot", ...snapshot };
}

export { API_HOST };
