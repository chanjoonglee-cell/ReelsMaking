function pct(v) {
  return typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—";
}

// 국가별 리텐션 × 결제율 인사이트 (하단 바)
export default function InsightBar({ insight }) {
  if (!insight) return null;
  const { rows = [], topRetention, topPayment, golden, note } = insight;

  return (
    <div>
      {/* 골든 세그먼트 + 1위 카드들 */}
      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <div className="md:col-span-1 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4">
          <div className="text-xs font-semibold text-emerald-700 mb-1">🏆 골든 세그먼트</div>
          <div className="text-lg font-bold">{golden?.label}</div>
          <div className="text-sm text-emerald-700 mt-1">{golden?.headline}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 mb-1">📈 리텐션 1위</div>
          <div className="text-lg font-bold text-sky-600">{topRetention?.label}</div>
          <div className="text-sm font-semibold">{topRetention?.value}</div>
          <div className="text-xs text-slate-400 mt-1">{topRetention?.sub}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 mb-1">💰 결제율 1위</div>
          <div className="text-lg font-bold text-amber-600">{topPayment?.label}</div>
          <div className="text-sm font-semibold">{topPayment?.value}</div>
          <div className="text-xs text-slate-400 mt-1">{topPayment?.sub}</div>
        </div>
      </div>

      {/* 국가별 표 */}
      <div className="overflow-x-auto">
        <table className="text-sm border-separate border-spacing-y-1 w-full">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left p-2 font-medium">국가</th>
              <th className="text-right p-2 font-medium">신규가입</th>
              <th className="text-right p-2 font-medium">결제자</th>
              <th className="text-center p-2 font-medium">D1 리텐션</th>
              <th className="text-center p-2 font-medium">결제전환율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.country}>
                <td className="p-2 font-medium whitespace-nowrap">{r.country}</td>
                <td className="p-2 text-right text-slate-500">{r.signups?.toLocaleString()}명</td>
                <td className="p-2 text-right text-slate-500">{r.payers}명</td>
                <td className="p-2 text-center">
                  <span className="inline-block px-2 py-0.5 rounded bg-sky-50 text-sky-700">
                    {pct(r.d1)}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                    {pct(r.payRate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {golden?.detail && (
        <p className="text-sm text-slate-600 mt-4 bg-slate-50 rounded-lg p-3">
          💡 {golden.detail}
        </p>
      )}
      <p className="text-xs text-slate-400 mt-2">{note}</p>
    </div>
  );
}
