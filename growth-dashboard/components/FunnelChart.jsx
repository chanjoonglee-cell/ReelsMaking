// 퍼널 단계별 가로 막대. steps: [{ label, count }]
export default function FunnelChart({ steps }) {
  const top = steps[0]?.count || 1;

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const pctOfTop = Math.round((s.count / top) * 100);
        const stepConv =
          i === 0 || steps[i - 1].count === 0
            ? null
            : Math.round((s.count / steps[i - 1].count) * 100);

        return (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">
                {i + 1}. {s.label}
              </span>
              <span className="text-slate-500">
                {s.count.toLocaleString()}명
                {stepConv !== null && (
                  <span className="ml-2 text-slate-400">직전 대비 {stepConv}%</span>
                )}
              </span>
            </div>
            <div className="h-7 bg-slate-100 rounded overflow-hidden">
              <div
                className="h-7 bg-emerald-500 rounded flex items-center px-2 text-white text-xs font-medium transition-all"
                style={{ width: `${Math.max(pctOfTop, 7)}%` }}
              >
                {pctOfTop}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
