import { useMemo } from "react";

/**
 * AttendanceCalendar — month view, color dots per day.
 * Props:
 *   year, month (1-12)
 *   records: [{ date: 'YYYY-MM-DD', status: 'present'|'half_day'|'absent'|'leave', under_review: bool }]
 *   onSelect?: (dateISO) => void
 *   compact?: bool
 */
export default function AttendanceCalendar({ year, month, records = [], onSelect, compact = false }) {
  const map = useMemo(() => {
    const m = {};
    records.forEach(r => { m[r.date] = r; });
    return m;
  }, [records]);

  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayISO = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, dateISO, rec: map[dateISO] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const STATUS_COLOR = {
    present:  "bg-emerald-500",
    half_day: "bg-amber-400",
    absent:   "bg-rose-500",
    leave:    "bg-sky-400",
  };

  const cellSize = compact ? "h-9" : "h-12 md:h-14";

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-[10px] font-bold uppercase text-slate-400 text-center tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const isToday = c.dateISO === todayISO;
          const isFuture = c.dateISO > todayISO;
          const dot = c.rec ? STATUS_COLOR[c.rec.status] || "bg-slate-300" : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect && onSelect(c.dateISO)}
              disabled={!onSelect}
              className={`relative ${cellSize} rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all
                ${isToday ? "border-[#FFA94D] bg-orange-50" : isFuture ? "border-slate-100 bg-slate-50/40 text-slate-300" : "border-slate-100 bg-white hover:bg-slate-50"}
                ${onSelect ? "cursor-pointer active:scale-95" : "cursor-default"}`}
            >
              <span className={`${isToday ? "text-[#F97316]" : "text-slate-700"}`}>{c.d}</span>
              {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} ${c.rec.under_review ? "ring-2 ring-amber-400 ring-offset-0" : ""}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <Legend color="bg-emerald-500" label="Present" />
        <Legend color="bg-amber-400" label="Half-day" />
        <Legend color="bg-rose-500" label="Absent" />
        <Legend color="bg-sky-400" label="Leave" />
        <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 ring-2 ring-amber-400" /> Under review</span>
      </div>
    </div>
  );
}

const Legend = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${color}`} /> {label}</span>
);
