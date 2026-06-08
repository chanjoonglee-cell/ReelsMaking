import { getDashboardData } from "@/lib/mixpanel";
import KpiCard from "@/components/KpiCard";
import FunnelChart from "@/components/FunnelChart";
import PaywallFunnel from "@/components/PaywallFunnel";
import RetentionMilestones from "@/components/RetentionMilestones";

export const revalidate = 3600; // 1시간 캐시 (Mixpanel API 한도 보호)

function pct(n) {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export default async function Page() {
  const data = await getDashboardData();
  const { funnels, retention } = data;

  const onb = funnels.onboarding.steps;
  const onbCompletion = onb[1].count / onb[0].count;
  const onbActivation = onb[2].count / onb[0].count;

  const pw = funnels.paywall.overall;
  const paywallConv = pw[2].count / pw[0].count;

  // 전체 리텐션 D1 (KPI용)
  const overallRow = retention.groups.find((g) => g.label === "전체")?.rows[0];
  const d1 = overallRow?.values?.[0];

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
              ? `스냅샷 데이터 · ${data.generatedAt} 기준`
              : data.partial
                ? `Mixpanel 라이브 (일부 스냅샷) · ${data.generatedAt}`
                : `Mixpanel 라이브 · ${data.generatedAt}`}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Phase 1 · Mixpanel 퍼널 / 리텐션</p>
      </header>

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard label="온보딩 완료율" value={pct(onbCompletion)} sub="시작 → 완료" accent="amber" />
        <KpiCard label="활성화율" value={pct(onbActivation)} sub="시작 → 첫 연습" accent="rose" />
        <KpiCard label="페이월 결제전환" value={pct(paywallConv)} sub="플랜조회 → 결제" accent="emerald" />
        <KpiCard label="D1 리텐션" value={pct(d1)} sub="전체 코호트" accent="sky" />
      </section>

      {/* 퍼널 2종 (세로 막대) */}
      <section className="grid md:grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold mb-1">{funnels.onboarding.name}</h2>
          <p className="text-xs text-slate-400 mb-6">{funnels.onboarding.description}</p>
          <FunnelChart steps={onb} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold mb-1">{funnels.paywall.name}</h2>
          <p className="text-xs text-slate-400 mb-4">{funnels.paywall.description}</p>
          <PaywallFunnel
            overall={funnels.paywall.overall}
            bySource={funnels.paywall.bySource}
            stepLabels={funnels.paywall.stepLabels}
          />
        </div>
      </section>

      {/* 리텐션 — D1/D7/D30/D90, 국가별/결제유저 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold mb-1">리텐션 (재방문)</h2>
        <p className="text-xs text-slate-400 mb-4">{retention.note}</p>
        <RetentionMilestones milestones={retention.milestones} groups={retention.groups} />
      </section>
    </main>
  );
}
