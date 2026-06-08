import { getDashboardData, getRetentionDimension } from "@/lib/mixpanel";
import RetentionExplorer from "@/components/RetentionExplorer";

export const revalidate = 3600;

export default async function Page() {
  const [data, overallRetention] = await Promise.all([
    getDashboardData(),
    getRetentionDimension("overall"),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* 헤더 */}
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">🌳 LanguageForest 그로스 대시보드</h1>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              data.source === "snapshot"
                ? "bg-amber-100 text-amber-700"
                : data.partial
                  ? "bg-sky-100 text-sky-700"
                  : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {data.source === "snapshot"
              ? `실데이터 · ${data.generatedAt} (MCP 추출)`
              : data.partial
                ? `Mixpanel 라이브 (일부 스냅샷) · ${data.generatedAt}`
                : `Mixpanel 라이브 · ${data.generatedAt}`}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Phase 1 · Mixpanel 리텐션 · 최근 30일</p>
      </header>

      {/* 리텐션 — 앱오픈 → 홈 체류, D1~D30, 세그먼트 전환 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold mb-1">리텐션 (D1~D30)</h2>
        <p className="text-xs text-slate-400 mb-4">
          앱을 연 사용자가 이후 며칠째 다시 홈에 머무는지(home_dwell) · 세그먼트 선택 가능
        </p>
        <RetentionExplorer initial={overallRetention} />
      </section>
    </main>
  );
}
