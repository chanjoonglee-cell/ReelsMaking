"use client";

import { useEffect, useState } from "react";
import LineChart from "./LineChart";

const DIMS = [
  { key: "overall", label: "전체" },
  { key: "completion", label: "학습 완주여부" },
  { key: "country", label: "국가별" },
  { key: "gender", label: "성별" },
  { key: "age", label: "나이대 (6세 단위)" },
  { key: "payment", label: "결제 여부" },
];

const RANGES = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 60, label: "60일" },
  { days: 90, label: "90일" },
];

const MILESTONES = [1, 7, 14, 30];

function pct(v) {
  return typeof v === "number" ? `${Math.round(v * 100)}%` : "—";
}

export default function RetentionExplorer({ initial }) {
  const [dim, setDim] = useState("overall");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(initial || null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState([]); // 숨긴 시리즈 이름

  useEffect(() => {
    if (dim === "overall" && days === 30 && data === initial) return;
    let active = true;
    setLoading(true);
    const qs = new URLSearchParams({ dim, days: String(days) });
    fetch(`/api/retention?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => active && (setData(d), setHidden([]), setLoading(false)))
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, days]);

  const series = data?.series ?? [];
  const toggle = (name) =>
    setHidden((h) => (h.includes(name) ? h.filter((n) => n !== name) : [...h, name]));

  return (
    <div>
      {/* 컨트롤: 세그먼트 + 기간 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm text-slate-500">
          세그먼트&nbsp;
          <select
            value={dim}
            onChange={(e) => setDim(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-800"
          >
            {DIMS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1 text-sm ${
                days === r.days ? "bg-emerald-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && <span className="text-xs text-slate-400">불러오는 중…</span>}
      </div>

      <LineChart series={series} maxDay={data?.maxDay || 30} hidden={hidden} onToggle={toggle} />

      {/* 마일스톤 요약 테이블 (체크 해제된 시리즈는 흐리게) */}
      <div className="overflow-x-auto mt-5">
        <table className="text-sm border-separate border-spacing-y-1 w-full">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left p-2 font-medium">세그먼트</th>
              <th className="text-right p-2 font-medium">코호트</th>
              {MILESTONES.map((m) => (
                <th key={m} className="p-2 text-center font-medium w-16">
                  D{m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.name} className={hidden.includes(s.name) ? "opacity-40" : ""}>
                <td className="p-2 font-medium whitespace-nowrap">
                  {s.name}
                  {s.small && (
                    <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      표본 적음
                    </span>
                  )}
                </td>
                <td className="p-2 text-right text-slate-500">
                  {(s.cohortSize ?? 0).toLocaleString()}명
                </td>
                {MILESTONES.map((m) => (
                  <td key={m} className="p-2 text-center text-slate-700">
                    {pct(s.rates?.[m])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">{data?.note}</p>
      {data?.rangeNote && <p className="text-xs text-amber-500 mt-1">{data.rangeNote}</p>}
    </div>
  );
}
