export default function KpiCard({ label, value, sub, accent = "emerald" }) {
  const accentColor = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    sky: "text-sky-600",
    rose: "text-rose-600",
    slate: "text-slate-700",
  }[accent];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentColor}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
