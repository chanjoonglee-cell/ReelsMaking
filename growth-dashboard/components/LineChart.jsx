// D1~maxDay 리텐션 라인 차트 (순수 SVG). 시리즈 on/off 토글 지원.
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6"];

function niceCeil(v) {
  if (v <= 0) return 0.1;
  const steps = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1];
  for (const s of steps) if (v <= s) return s;
  return 1;
}

export default function LineChart({ series = [], maxDay = 30, hidden = [], onToggle }) {
  const W = 680;
  const H = 300;
  const pad = { l: 40, r: 12, t: 16, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const hiddenSet = new Set(hidden);
  const days = [];
  for (let d = 1; d <= maxDay; d++) days.push(d);

  // 보이는 시리즈만으로 y 스케일 계산 (색은 원본 인덱스 고정)
  let peak = 0;
  series.forEach((s, i) => {
    if (hiddenSet.has(s.name) || !Array.isArray(s.rates)) return;
    for (const d of days) {
      const v = s.rates[d];
      if (typeof v === "number" && v > peak) peak = v;
    }
  });
  const yMax = niceCeil(peak);

  const x = (d) => pad.l + ((d - 1) / (maxDay - 1)) * innerW;
  const y = (r) => pad.t + innerH * (1 - r / yMax);
  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= maxDay);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 12} textAnchor="middle" fontSize="10" fill="#94a3b8">
            D{d}
          </text>
        ))}
        {series.map((s, si) => {
          if (hiddenSet.has(s.name) || !Array.isArray(s.rates) || s.rates.length < 2) return null;
          const color = COLORS[si % COLORS.length];
          const valid = days.filter((d) => typeof s.rates[d] === "number");
          const pts = valid.map((d) => `${x(d)},${y(s.rates[d])}`).join(" ");
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
              {valid.map((d) => (
                <circle key={d} cx={x(d)} cy={y(s.rates[d])} r="2" fill={color} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* 범례 = 체크박스 토글 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 text-xs">
        {series.map((s, si) => {
          const off = hiddenSet.has(s.name);
          const color = COLORS[si % COLORS.length];
          return (
            <button
              key={s.name}
              onClick={() => onToggle && onToggle(s.name)}
              className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded transition ${
                off ? "opacity-40" : "hover:bg-slate-100"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-sm border"
                style={{ background: off ? "transparent" : color, borderColor: color }}
              />
              <span className="text-slate-700">{s.name}</span>
              <span className="text-slate-400">({s.cohortSize?.toLocaleString() ?? 0})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
