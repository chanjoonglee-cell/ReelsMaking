"use client";

import { useState } from "react";
import FunnelChart from "./FunnelChart";

// 유입 채널(acquisition_source)별로 결제 퍼널을 전환해서 보여준다.
export default function PaywallFunnel({ overall, bySource, stepLabels }) {
  const sources = ["전체", ...Object.keys(bySource)];
  const [selected, setSelected] = useState("전체");

  const counts =
    selected === "전체" ? overall.map((s) => s.count) : bySource[selected];

  const steps = stepLabels.map((label, i) => ({ label, count: counts[i] }));

  const overallConv =
    counts[0] > 0 ? Math.round((counts[counts.length - 1] / counts[0]) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm text-slate-500">
          유입 채널&nbsp;
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-800"
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-slate-500">
          전체 전환 <span className="font-bold text-emerald-600">{overallConv}%</span>
        </span>
      </div>
      <FunnelChart steps={steps} />
    </div>
  );
}
