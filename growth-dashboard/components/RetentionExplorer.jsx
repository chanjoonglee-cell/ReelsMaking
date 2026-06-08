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

const MILESTONES = [1, 7, 14, 30];

function pct(v) {
  return typeof v === "number" ? `${Math.round(v * 100)}%` : "—";
}

export default function RetentionExplorer({ initial }) {
  const [dim, setDim] = useState("overall");
  const [since, setSince] = useState(initial?.since || "");
  const [data, setData] = useState(initial || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // 첫 렌더는 서버에서 받은 initial(overall) 사용 → 불필요한 재요청 방지
    if (dim === "overall" && since === (initial?.since || "") && data === initial) return;

    let active = true;
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ dim });
    if (since) qs.set("since", since);
    fetch(`/api/retention?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => active && (setData(d), setLoading(false)))
      .catch((e) => active && (setErr(String(e)), setLoading(false)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim, since]);

  const series = data?.series ?? [];

  return (
    <div>
      {/* 컨트롤 */}
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
        {loading && <span className="text-xs text-slate-400">불러오는 중…</span>}
      </div>

      {err && <div className="text-sm text-rose-600 mb-3">에러: {err}</div>}

      {data?.liveOnly ? (
        <div className="h-40 flex items-center justify-center text-sm text-slate-400 text-center">
          이 세그먼트는 Mixpanel 라이브 연결 시 제공됩니다.
          <br />
          (.env 에 Service Account 키 설정)
        </div>
      ) : (
        <>
          <LineChart series={series} maxDay={data?.maxDay || 30} />

          {/* 마일스톤 요약 테이블 */}
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
                  <tr key={s.name}>
                    <td className="p-2 font-medium whitespace-nowrap">
                      {s.name}
                      {s.small && (
                        <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          표본 적음
                        </span>
                      )}
                      {s.unavailable && (
                        <span className="ml-2 text-[10px] text-slate-400">{s.reason}</span>
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
        </>
      )}

      <p className="text-xs text-slate-400 mt-3">{data?.note}</p>
    </div>
  );
}
