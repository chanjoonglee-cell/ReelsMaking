import { getDashboardData } from "@/lib/mixpanel";
import KpiCard from "@/components/KpiCard";
import FunnelChart from "@/components/FunnelChart";
import PaywallFunnel from "@/components/PaywallFunnel";
import RetentionCurve from "@/components/RetentionCurve";

export const revalidate = 3600; // 1시간 캐시 (Mixpanel API 한도 보호)

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

export default async function Page() {
  const data = await getDashboardData();
  const { funnels, retention, baseline } = data;

  const onb = funnels.onboarding.steps;
  const onbCompletion = onb[1].count / onb[0].count;
  const onbActivation = onb[2].count / onb[0].count;

  const pw = funnels.paywall.overall;
  const paywallConv = pw[2].count / pw[0].count;

  const w1Retention = retention.series["전체"].rates[1];

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
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {data.source === "snapshot"
              ? `스냅샷 데이터 · ${data.generatedAt} 기준`
              : "Mixpanel 라이브"}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Phase 1 · Mixpanel 퍼널 / 리텐션 (최근 {data.dateRangeDays}일)
        </p>
      </header>

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard label="온보딩 완료율" value={pct(onbCompletion)} sub="시작 → 완료" accent="amber" />
        <KpiCard label="활성화율" value={pct(onbActivation)} sub="시작 → 첫 연습" accent="rose" />
        <KpiCard label="페이월 결제전환" value={pct(paywallConv)} sub="플랜조회 → 결제" accent="emerald" />
        <KpiCard label="1주 리텐션" value={pct(w1Retention)} sub="전체 코호트" accent="sky" />
      </section>

      {/* 퍼널 2종 */}
      <section className="grid md:grid-cols-2 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold mb-1">{funnels.onboarding.name}</h2>
          <p className="text-xs text-slate-400 mb-4">{funnels.onboarding.description}</p>
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

      {/* 리텐션 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-8">
        <h2 className="font-semibold mb-1">{retention.name}</h2>
        <p className="text-xs text-slate-400 mb-4">
          구독 여부별 주간 리텐션 · 진할수록 잔존율 높음
        </p>
        <RetentionCurve retention={retention} />
      </section>

      {/* 매출 베이스라인 (참고) */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold mb-1">매출 베이스라인 (참고)</h2>
        <p className="text-xs text-slate-400 mb-4">{baseline.source}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="결제 전환율" value={pct(baseline.purchaseConversionRate)} accent="slate" />
          <KpiCard label="ARPPU" value={`${baseline.arppu.toLocaleString()}원`} accent="slate" />
          <KpiCard label="ARPU" value={`${baseline.arpu.toLocaleString()}원`} accent="slate" />
          <KpiCard
            label="누적 매출"
            value={`${baseline.cumulativeRevenue.toLocaleString()}원`}
            accent="slate"
          />
        </div>
        <p className="text-xs text-slate-400 mt-4">
          ⏭️ Phase 2에서 RevenueCat 연동 → 실시간 매출·LTV로 대체. Phase 3에서 AppsFlyer
          광고비 연동 → CAC, LTV/CAC 완성.
        </p>
      </section>
    </main>
  );
}
