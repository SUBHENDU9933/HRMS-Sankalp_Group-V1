import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listEmployees } from "@/lib/data";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * AdminAttendanceGrid — One row per active employee, last N days as columns,
 * each cell colored by attendance status. Click cell → /attendance.
 */
export default function AdminAttendanceGrid({ days = 14 }) {
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);          // attendance rows
  const [loading, setLoading] = useState(true);
  const [endOffset, setEndOffset] = useState(0); // 0 = ending today, 14 = 14 days back

  const dateList = useMemo(() => {
    const out = [];
    const base = new Date();
    base.setDate(base.getDate() - endOffset);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [days, endOffset]);

  useEffect(() => {
    listEmployees({ status: "active" }).then(setEmployees).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = dateList[0];
    const to   = dateList[dateList.length - 1];
    supabase.from("attendance")
      .select("employee_id, date, status, under_review")
      .gte("date", from).lte("date", to)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setRows([]); } else { setRows(data || []); }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateList]);

  const cellMap = useMemo(() => {
    const m = {};
    rows.forEach(r => { m[`${r.employee_id}|${r.date}`] = r; });
    return m;
  }, [rows]);

  const COLOR = {
    present:  "bg-emerald-500",
    half_day: "bg-amber-400",
    absent:   "bg-rose-500",
    leave:    "bg-sky-400",
  };

  return (
    <div data-testid="admin-attendance-grid">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-extrabold flex items-center gap-2">
          <span>📅</span> Team Attendance — last {days} days
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setEndOffset(o => o + days)} className="sk-btn-ghost px-2 py-1.5"><ChevronLeft className="w-4 h-4" /></button>
          <button disabled={endOffset === 0} onClick={() => setEndOffset(o => Math.max(0, o - days))} className="sk-btn-ghost px-2 py-1.5 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider pr-3 py-2 min-w-[160px]">Employee</th>
              {dateList.map(d => {
                const dt = new Date(d);
                const isToday = d === new Date().toISOString().slice(0, 10);
                const isWknd = dt.getDay() === 0 || dt.getDay() === 6;
                return (
                  <th key={d} className={`text-center font-semibold py-2 px-1 ${isToday ? "text-[#F97316]" : isWknd ? "text-slate-300" : "text-slate-500"}`}>
                    <div className="text-[10px] uppercase">{dt.toLocaleDateString("en-IN", { weekday: "short" }).slice(0,1)}</div>
                    <div className="text-xs">{dt.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={dateList.length + 1} className="py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && employees.length === 0 && <tr><td colSpan={dateList.length + 1} className="py-6 text-center text-slate-400">No active employees</td></tr>}
            {!loading && employees.map(e => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="sticky left-0 bg-white z-10 pr-3 py-2">
                  <Link to="/attendance" className="font-semibold text-slate-800 text-xs truncate block max-w-[160px] hover:text-[#4DA3FF]">{e.name}</Link>
                  <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{e.designation || e.role}</div>
                </td>
                {dateList.map(d => {
                  const r = cellMap[`${e.id}|${d}`];
                  const c = r ? COLOR[r.status] || "bg-slate-300" : "";
                  return (
                    <td key={d} className="text-center py-2 px-1">
                      <div className="mx-auto w-6 h-6 rounded grid place-items-center">
                        {r ? (
                          <span title={`${r.status}${r.under_review ? " (under review)" : ""}`} className={`w-2.5 h-2.5 rounded-full ${c} ${r.under_review ? "ring-2 ring-amber-400" : ""}`} />
                        ) : (
                          <span className="text-slate-200">·</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
