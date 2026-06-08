// 세로 막대 퍼널 — x축: 단계, y축: 전환율(첫 단계 대비 %).
export default function FunnelChart({ steps }) {
  const top = steps[0]?.count || 1;
  const BAR_AREA = 160; // px

  return (
    <div className="flex items-stretch justify-between gap-3">
      {steps.map((s, i) => {
        const pctOfTop = Math.round((s.count / top) * 100);
        const stepConv =
          i === 0 || steps[i - 1].count === 0
            ? null
            : Math.round((s.count / steps[i - 1].count) * 100);

        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            {/* 막대 영역 (고정 높이, 바닥 정렬) */}
            <div className="flex items-end w-full" style={{ height: BAR_AREA }}>
              <div
                className="w-3/5 mx-auto bg-emerald-500 rounded-t relative transition-all"
                style={{ height: `${Math.max(pctOfTop, 2)}%` }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold text-emerald-700">
                  {pctOfTop}%
                </span>
              </div>
            </div>
            {/* x축 라벨 */}
            <div className="mt-2 text-center">
              <div className="text-xs font-medium text-slate-700 leading-tight">
                {i + 1}. {s.label}
              </div>
              <div className="text-xs text-slate-400">{s.count.toLocaleString()}명</div>
              {stepConv !== null && (
                <div className="text-[10px] text-slate-400">직전 대비 {stepConv}%</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
