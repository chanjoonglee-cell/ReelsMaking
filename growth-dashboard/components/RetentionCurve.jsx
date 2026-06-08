// 세그먼트(구독 여부)별 리텐션 히트맵 테이블.
function cellColor(rate) {
  const a = Math.min(Math.max(rate, 0), 1);
  return `rgba(16, 185, 129, ${0.08 + a * 0.82})`;
}

export default function RetentionCurve({ retention }) {
  const { periods, series } = retention;
  const names = Object.keys(series);

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-separate border-spacing-1">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left p-2 font-medium">세그먼트</th>
            <th className="text-right p-2 font-medium">코호트</th>
            {periods.map((p) => (
              <th key={p} className="p-2 text-center font-medium w-12">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((name) => (
            <tr key={name}>
              <td className="p-2 font-medium whitespace-nowrap">{name}</td>
              <td className="p-2 text-right text-slate-500">
                {series[name].cohortSize.toLocaleString()}명
              </td>
              {series[name].rates.map((r, i) => (
                <td
                  key={i}
                  className="p-1 text-center rounded text-xs"
                  style={{
                    background: cellColor(r),
                    color: r > 0.5 ? "white" : "#334155",
                  }}
                >
                  {Math.round(r * 100)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
