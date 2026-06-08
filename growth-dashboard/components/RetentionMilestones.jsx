import { Fragment } from "react";

function pct(v) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function cellColor(v) {
  if (v == null) return "transparent";
  const a = Math.min(Math.max(v, 0), 1);
  return `rgba(16, 185, 129, ${0.08 + a * 0.82})`;
}

// 세그먼트(전체/국가별/결제) × 마일스톤(D1/D7/D30/D90) 리텐션 테이블.
export default function RetentionMilestones({ milestones, groups }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-separate border-spacing-y-1 w-full">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left p-2 font-medium">세그먼트</th>
            <th className="text-right p-2 font-medium">코호트</th>
            {milestones.map((m) => (
              <th key={m} className="p-2 text-center font-medium w-16">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.label}>
              <tr>
                <td
                  colSpan={2 + milestones.length}
                  className="pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                >
                  {g.label}
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.name}>
                  <td className="p-2 font-medium whitespace-nowrap">
                    {r.name}
                    {r.small && (
                      <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        표본 적음
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right text-slate-500">
                    {r.cohortSize.toLocaleString()}명
                  </td>
                  {r.values.map((v, i) => (
                    <td
                      key={i}
                      className="p-1 text-center rounded text-xs"
                      style={{
                        background: cellColor(v),
                        color: v != null && v > 0.5 ? "white" : "#334155",
                      }}
                    >
                      {pct(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
