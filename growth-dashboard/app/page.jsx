import { getMeta, getInsight, getRetentionDimension } from "@/lib/mixpanel";
import RetentionExplorer from "@/components/RetentionExplorer";
import InsightBar from "@/components/InsightBar";

export const revalidate = 3600;

export default async function Page() {
  const [meta, overallRetention, insight] = await Promise.all([
    getMeta(),
    getRetentionDimension("overall"),
    getInsight(),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* 헤더 */}
      <header className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">🌳 LanguageForest 그로스 대시보드</h1>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              meta.source === "snapshot"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {meta.source === "snapshot"
              ? `실데이터 · ${meta.generatedAt} (MCP 추출)`
              : `Mixpanel 라이브 · ${meta.generatedAt}`}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Phase 1 · Mixpanel 리텐션 · 첫 가입일(첫 앱 실행) 기준 · 최근 30일
        </p>
      </header>

      {/* 리텐션 — 첫 앱 실행 → 앱오픈, D1~D30, 세그먼트 전환 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <h2 className="font-semibold mb-1">신규유저 리텐션 (D1~D30)</h2>
        <p className="text-xs text-slate-400 mb-4">
          첫 앱 실행($ae_first_open)일 기준 코호트가 이후 며칠째 다시 앱을 여는지 · 세그먼트 선택 가능
        </p>
        <RetentionExplorer initial={overallRetention} />
      </section>

      {/* 하단 인사이트 바 — 국가별 리텐션 × 결제율 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold mb-1">🔍 인사이트 — 국가별 리텐션 × 결제율</h2>
        <p className="text-xs text-slate-400 mb-4">
          어느 국가/세그먼트가 가장 잘 남고, 가장 잘 결제하는가
        </p>
        <InsightBar insight={insight} />
      </section>
    </main>
  );
}
