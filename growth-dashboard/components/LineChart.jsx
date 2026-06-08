// D1~maxDay 리텐션 라인 차트 (의존성 없는 순수 SVG, 멀티 시리즈).
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"];

function niceCeil(v) {
  if (v <= 0) return 0.1;
  const steps = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1];
  for (const s of steps) if (v <= s) return s;
  return 1;
}

export default function LineChart({ series = [], maxDay = 30 }) {
  const W = 680;
  const H = 300;
  const pad = { l: 40, r: 12, t: 16, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const drawable = series.filter((s) => Array.isArray(s.rates) && s.rates.length > 1);

  // 표시 구간: Day 1 ~ maxDay (Day 0 = 가입 당일 스파이크는 제외)
  const days = [];
  for (let d = 1; d <= maxDay; d++) days.push(d);

  let peak = 0;
  for (const s of drawable) {
    for (const d of days) {
      const v = s.rates[d];
      if (typeof v === "number" && v > peak) peak = v;
    }
  }
  const yMax = niceCeil(peak);

  const x = (d) => pad.l + ((d - 1) / (maxDay - 1)) * innerW;
  const y = (r) => pad.t + innerH * (1 - r / yMax);

  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= maxDay);

  if (!drawable.length) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-slate-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* y 그리드 + 라벨 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {/* x 라벨 */}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 12} textAnchor="middle" fontSize="10" fill="#94a3b8">
            D{d}
          </text>
        ))}
        {/* 시리즈 */}
        {drawable.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          const pts = days
            .filter((d) => typeof s.rates[d] === "number")
            .map((d) => `${x(d)},${y(s.rates[d])}`)
            .join(" ");
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
              {days
                .filter((d) => typeof s.rates[d] === "number")
                .map((d) => (
                  <circle key={d} cx={x(d)} cy={y(s.rates[d])} r="2" fill={color} />
                ))}
            </g>
          );
        })}
      </svg>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
        {drawable.map((s, si) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-slate-600">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: COLORS[si % COLORS.length] }}
            />
            {s.name}
            <span className="text-slate-400">({s.cohortSize?.toLocaleString() ?? 0}명)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
