import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import SelfieCapture from "@/components/SelfieCapture";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import MonthYearPicker from "@/components/MonthYearPicker";
import {
  listAttendance, upsertAttendance, updateAttendance, deleteAttendance,
  listEmployees, uploadDataUrl, getCompanySettings,
} from "@/lib/data";
import { fmtDateTime, todayISO, getGPS, MONTHS } from "@/lib/utils-app";
import { haversineMeters, isInsideOffice, fmtDistance } from "@/lib/geo";
import {
  Camera, MapPin, CheckCircle2, AlertCircle, Clock, Trash2, Building2,
  AlertTriangle, Loader2, Users, X,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "present",        label: "✅ Present",        color: "bg-emerald-500" },
  { value: "late",           label: "🕒 Late",            color: "bg-amber-500" },
  { value: "half_day",       label: "🟡 Half-day",        color: "bg-amber-400" },
  { value: "absent",         label: "🔴 Absent",          color: "bg-rose-500" },
  { value: "paid_leave",     label: "🟦 Paid Leave",      color: "bg-sky-500" },
  { value: "non_paid_leave", label: "⚫ Non-paid Leave",  color: "bg-slate-500" },
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label]));

/** Auto-classify status based on company timing rules and current punch-in time. */
function autoClassifyStatus(settings, now = new Date()) {
  if (!settings?.office_in_time) return "present";
  const [h, m] = (settings.office_in_time || "09:30:00").split(":").map(Number);
  const officeIn = new Date(now); officeIn.setHours(h || 9, m || 30, 0, 0);
  const lateMin = (now - officeIn) / 60000;
  if (lateMin < (settings.late_after_min || 15))      return "present";
  if (lateMin < (settings.half_day_after_min || 120)) return "late";
  if (lateMin < (settings.absent_after_min || 240))   return "half_day";
  return "absent";
}

export default function AttendancePage() {
  const { user, isAdmin, isManager } = useAuth();
  const canAdmin = isAdmin || isManager;
  return canAdmin ? <AdminAttendance user={user} isAdmin={isAdmin} /> : <EmployeeAttendance user={user} />;
}

/* ==================== ADMIN VIEW ==================== */
function AdminAttendance({ user, isAdmin }) {
  const today = new Date();
  const [period, setPeriod] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);

  const monthStart = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  // Last day of month — computed as a STRING to avoid timezone shift via toISOString().
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const monthEnd = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const reload = async () => {
    setLoading(true);
    // Auto-finalize stale "under_review" absences (past dates or after 8 PM IST today)
    try { await supabase.rpc("finalize_late_review"); } catch {}
    const [emps, all] = await Promise.all([
      listEmployees({ status: "active" }),
      listAttendance({ date_from: monthStart, date_to: monthEnd }),
    ]);
    setEmployees(emps);
    setRows(all);
    setLoading(false);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [period.year, period.month]);

  // Per-day aggregate count for calendar
  const dayCounts = useMemo(() => {
    const m = {};
    rows.forEach(r => {
      m[r.date] = m[r.date] || { present: 0, half: 0, absent: 0, leave: 0 };
      if (r.status === "present" || r.status === "late" || r.status === "paid_leave") m[r.date].present++;
      else if (r.status === "half_day") m[r.date].half++;
      else if (r.status === "absent" || r.status === "non_paid_leave") m[r.date].absent++;
      else m[r.date].leave++;
    });
    return m;
  }, [rows]);

  // Calendar marker rows (one synthetic record per date so AttendanceCalendar shows a dot)
  const calendarRecords = Object.keys(dayCounts).map(date => {
    const d = dayCounts[date];
    const dominant = d.present >= d.half && d.present >= d.absent ? "present"
                   : d.absent >= d.half ? "absent" : "half_day";
    return { date, status: dominant };
  });

  // Records for the selected date
  const dateRecords = rows.filter(r => r.date === selectedDate);
  const employeeMapForDate = useMemo(() => {
    const m = {};
    dateRecords.forEach(r => { m[r.employee_id] = r; });
    return m;
  }, [dateRecords]);

  const setStatus = async (emp, newStatus) => {
    const existing = employeeMapForDate[emp.id];
    try {
      if (existing) {
        await updateAttendance(existing.id, { status: newStatus, under_review: false });
      } else {
        const r = await upsertAttendance({ employee_id: emp.id, date: selectedDate, status: newStatus });
        try { await updateAttendance(r.id, { attendance_type: "office", location_label: "🏢 Admin-entered", under_review: false }); } catch {}
      }
      toast.success(`${emp.name} → ${STATUS_LABEL[newStatus]}`);
      reload();
    } catch (e) { toast.error(e.message || "Failed"); }
  };

  const del = async (id) => { if (!window.confirm("Delete this record?")) return; await deleteAttendance(id); toast.success("Deleted"); reload(); };

  return (
    <div className="sk-page space-y-5" data-testid="attendance-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>📅</span> Attendance — Admin</h1>
          <p className="text-sm text-slate-500 mt-1">Click any date in the calendar to mark / edit that day for every employee.</p>
        </div>
        <MonthYearPicker value={period} onChange={setPeriod} />
      </div>

      {/* Bulk back-fill */}
      <BulkBackfillForm employees={employees} onSaved={reload} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Calendar */}
        <div className="sk-card p-5 lg:col-span-3">
          <h2 className="font-heading text-lg font-extrabold mb-3 flex items-center gap-2"><span>🗓️</span> {MONTHS[period.month]} {period.year} — team overview</h2>
          {loading ? <div className="text-slate-400 py-8 text-center">Loading…</div> : (
            <AttendanceCalendar year={period.year} month={period.month} records={calendarRecords} onSelect={setSelectedDate} />
          )}
          <div className="mt-3 text-xs text-slate-500">Selected: <b className="text-slate-700">{selectedDate}</b></div>
        </div>

        {/* Right panel: employee-wise FULL detail for selected date */}
        <div className="sk-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-extrabold flex items-center gap-2"><Users className="w-5 h-5 text-[#4DA3FF]" /> {selectedDate}</h2>
            <span className="text-xs text-slate-500">{dateRecords.length} / {employees.length} marked</span>
          </div>
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {employees.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No employees</div>}
            {employees.map(e => {
              const r = employeeMapForDate[e.id];
              return <DateDetailCard key={e.id} emp={e} record={r} onSetStatus={setStatus} onDelete={del} isAdmin={isAdmin} />;
            })}
          </div>
        </div>
      </div>

      {/* Employee-wise FULL MONTH report */}
      <EmployeeMonthReport employees={employees} period={period} rows={rows} isAdmin={isAdmin} onChanged={reload} />
    </div>
  );
}

/** Detail card for one employee on the selected date — shows selfie, time, GPS, status. */
function DateDetailCard({ emp, record, onSetStatus, onDelete, isAdmin }) {
  const r = record;
  const status = r?.status;
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  return (
    <div className={`rounded-xl border ${r ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/40"} p-3`}>
      <div className="flex items-start gap-3">
        {/* Selfie thumb or initials */}
        {r?.selfie_url ? (
          <a href={r.selfie_url} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={r.selfie_url} alt="" className="w-14 h-14 rounded-lg object-cover border-2 border-[#F97316]" />
          </a>
        ) : (
          <div className="shrink-0 w-14 h-14 rounded-lg bg-[#1E3A8A] grid place-items-center text-white font-extrabold text-base border-2 border-[#FFA94D]">
            {emp.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-sm text-slate-900 truncate">{emp.name}</div>
            {opt && <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-bold ${opt.color}`}>{opt.label}</span>}
          </div>
          <div className="text-[10px] text-slate-400 truncate">{emp.designation || emp.role}</div>

          {r ? (
            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
              {r.check_in_time && <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#4DA3FF]" /> {fmtDateTime(r.check_in_time)}</div>}
              {r.location_label && <div className="truncate">{r.location_label}</div>}
              {r.latitude != null && (
                <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                  <MapPin className="w-3 h-3 text-[#F97316]" /> {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                  {r.distance_m != null && <span> · {fmtDistance(r.distance_m)} from office</span>}
                </div>
              )}
              {r.under_review && <div className="text-amber-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under review</div>}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-slate-400 italic">No attendance recorded for this date.</div>
          )}
        </div>
      </div>

      {/* Edit / Delete row */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <select
          value={status || ""}
          onChange={ev => onSetStatus(emp, ev.target.value)}
          className="sk-input !py-1 !px-2 text-xs flex-1"
          data-testid={`status-${emp.id}`}
        >
          <option value="">— Mark —</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {r && isAdmin && <button onClick={() => onDelete(r.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded" title="Delete record"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
    </div>
  );
}

/** Employee-wise full month report — pick an employee, see every day with details. */
function EmployeeMonthReport({ employees, period, rows, isAdmin, onChanged }) {
  const [empId, setEmpId] = useState("");
  const empRows = rows
    .filter(r => r.employee_id === empId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const summary = empRows.reduce((acc, r) => {
    if (r.status === "present" || r.status === "late" || r.status === "paid_leave") acc.present++;
    else if (r.status === "half_day") acc.half++;
    else if (r.status === "absent" || r.status === "non_paid_leave" || r.status === "leave") acc.absent++;
    return acc;
  }, { present: 0, half: 0, absent: 0 });

  const onDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try { await deleteAttendance(id); toast.success("Deleted"); onChanged(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="sk-card p-5" data-testid="employee-month-report">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-heading text-lg font-extrabold flex items-center gap-2"><span>📋</span> Employee monthly report</h2>
        <select value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input w-auto md:w-72" data-testid="report-employee">
          <option value="">Select an employee…</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {!empId ? (
        <div className="py-8 text-center text-slate-400 text-sm">Choose an employee to see {MONTHS[period.month]} {period.year} report.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SummaryCard color="emerald" label="Present (incl. late + paid leave)" value={summary.present} />
            <SummaryCard color="amber"   label="Half-day" value={summary.half} />
            <SummaryCard color="rose"    label="Absent / Non-paid" value={summary.absent} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Check-in</th>
                <th className="py-2 pr-3">Location / GPS</th>
                <th className="py-2 pr-3">Distance</th>
                <th className="py-2 pr-3">Selfie</th>
                <th className="py-2 pr-3 text-right"></th>
              </tr></thead>
              <tbody>
                {empRows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400">No attendance for this employee in {MONTHS[period.month]} {period.year}</td></tr>}
                {empRows.map(r => {
                  const opt = STATUS_OPTIONS.find(o => o.value === r.status);
                  return (
                    <tr key={r.id} className={`border-b border-slate-100 ${r.under_review ? "bg-amber-50/40" : ""}`}>
                      <td className="py-2 pr-3 font-semibold whitespace-nowrap">{r.date}</td>
                      <td className="py-2 pr-3">
                        {opt && <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-bold ${opt.color}`}>{opt.label}</span>}
                        {r.under_review && <span className="ml-1 sk-badge bg-amber-100 text-amber-800">review</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">{r.check_in_time ? fmtDateTime(r.check_in_time) : "—"}</td>
                      <td className="py-2 pr-3 text-xs">
                        <div>{r.location_label || "—"}</div>
                        {r.latitude != null && <div className="font-mono text-[10px] text-slate-500">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</div>}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{r.distance_m != null ? fmtDistance(r.distance_m) : "—"}</td>
                      <td className="py-2 pr-3">
                        {r.selfie_url
                          ? <a href={r.selfie_url} target="_blank" rel="noreferrer"><img src={r.selfie_url} className="w-10 h-10 rounded object-cover border" alt="" /></a>
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">{isAdmin && <button onClick={() => onDelete(r.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const SummaryCard = ({ color, label, value }) => {
  const STYLES = {
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber:   "bg-amber-50 border-amber-100 text-amber-700",
    rose:    "bg-rose-50 border-rose-100 text-rose-700",
  };
  return (
    <div className={`rounded-xl p-3 border ${STYLES[color]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-heading text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
};

/** Bulk back-fill: pick an employee, date range, status. Loops upsert for every day in range. */
function BulkBackfillForm({ employees, onSaved }) {
  const [form, setForm] = useState({ employee_id: "", date_from: todayISO(), date_to: todayISO(), status: "present", notes: "" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) { toast.error("Pick an employee"); return; }
    if (form.date_from > form.date_to) { toast.error("Invalid range"); return; }
    setBusy(true);
    try {
      // UTC math so the last day of the month is never dropped due to timezone shift
      const [y1, m1, d1] = form.date_from.split("-").map(Number);
      const [y2, m2, d2] = form.date_to.split("-").map(Number);
      const cur  = new Date(Date.UTC(y1, m1 - 1, d1));
      const last = new Date(Date.UTC(y2, m2 - 1, d2));
      const dates = [];
      while (cur <= last) {
        const yyyy = cur.getUTCFullYear();
        const mm   = String(cur.getUTCMonth() + 1).padStart(2, "0");
        const dd   = String(cur.getUTCDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      let count = 0;
      const total = dates.length;
      for (const dateISO of dates) {
        const row = await upsertAttendance({ employee_id: form.employee_id, date: dateISO, status: form.status, notes: form.notes || null });
        try { await updateAttendance(row.id, { attendance_type: "office", under_review: false, location_label: "🏢 Admin bulk-entry" }); } catch {}
        count++;
        setProgress({ count, total });
      }
      toast.success(`Saved ${count} day${count > 1 ? "s" : ""} for ${employees.find(x => x.id === form.employee_id)?.name || ""}`);
      setForm({ ...form, notes: "" });
      onSaved();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); setProgress(null); }
  };

  return (
    <form onSubmit={submit} className="sk-card p-5 space-y-3 border-2 border-[#4DA3FF]/20" data-testid="admin-backfill-form">
      <div className="font-heading font-extrabold text-base flex items-center gap-2"><span>✏️</span> Bulk add / overwrite attendance (date range)</div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="sk-input md:col-span-2" data-testid="bulk-employee">
          <option value="">Select employee…</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500">From</div>
          <input type="date" required value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} className="sk-input" data-testid="bulk-from" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500">To</div>
          <input type="date" required value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} className="sk-input" data-testid="bulk-to" />
        </div>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="sk-input" data-testid="bulk-status">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button disabled={busy} className="sk-btn-primary" data-testid="bulk-submit">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "+"} {progress ? `${progress.count}/${progress.total}` : "Apply"}
        </button>
      </div>
      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional, e.g. “migrated from paper register”)" className="sk-input" />
      <div className="text-[11px] text-slate-500">Each date in the range gets the chosen status. Existing entries on those dates are overwritten.</div>
    </form>
  );
}

/* ==================== EMPLOYEE VIEW ==================== */
function EmployeeAttendance({ user }) {
  const Y = new Date().getFullYear();
  const M = new Date().getMonth() + 1;
  const [me, setMe] = useState([]);
  const [today, setToday] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(null);

  const loadMe = async () => {
    const rows = await listAttendance({ employee_id: user.id });
    setMe(rows);
    setToday(rows.find(a => a.date === todayISO()) || null);
  };
  useEffect(() => { loadMe(); getCompanySettings().then(setSettings).catch(() => {}); /* eslint-disable-next-line */ }, [user.id]);

  const saveAttendance = async ({ status, selfie_url, gps }) => {
    let underReview = false, distance = null, label = settings ? `🏢 @ ${settings.name || "Office"}` : "🏢 @ Office";
    if (gps?.latitude != null && settings?.office_lat != null) {
      distance = haversineMeters(gps.latitude, gps.longitude, settings.office_lat, settings.office_lng);
      if (!isInsideOffice(gps.latitude, gps.longitude, settings)) {
        underReview = true;
        label = `🚧 Outside office (${fmtDistance(distance)} away) — under review`;
      }
    } else if (gps?.latitude == null) {
      underReview = true;
      label = "📡 GPS unavailable — under review";
    }
    // Late punch-in (status=='absent') always goes for admin review until 8 PM IST.
    if (status === "absent") underReview = true;
    await upsertAttendance({
      employee_id: user.id, date: todayISO(), status,
      selfie_url, latitude: gps?.latitude, longitude: gps?.longitude,
    });
    try {
      const just = await listAttendance({ employee_id: user.id });
      const t = just.find(a => a.date === todayISO());
      if (t) await updateAttendance(t.id, { attendance_type: "office", location_label: label, distance_m: distance, under_review: underReview });
    } catch { /* schema mismatch */ }
    if (underReview) toast("Submitted for review (outside geofence)", { icon: "⚠️" });
    else toast.success(`Marked ${STATUS_LABEL[status] || status}`);
    await loadMe();
  };

  const onCapture = async (dataUrl, gps) => {
    setShowCapture(false); setBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl, "attendance");
      const status = autoClassifyStatus(settings);
      await saveAttendance({ status, selfie_url: url, gps });
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setBusy(false); }
  };

  const StatusIcon = ({ s }) => s === "present" || s === "late" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : s === "absent" || s === "non_paid_leave" ? <AlertCircle className="w-4 h-4 text-rose-500" />
    : <Clock className="w-4 h-4 text-amber-500" />;

  return (
    <div className="sk-page space-y-5" data-testid="attendance-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>✅</span> Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Selfie + GPS verified daily attendance. Status auto-set based on punch-in time vs office timing.</p>
      </div>

      {/* Today's strip */}
      <div className="relative rounded-2xl bg-[#1E3A8A] p-5 text-white shadow-md overflow-hidden" data-testid="today-card">
        <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-[#F97316]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-90">Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</div>
            {today ? (
              <>
                <div className="font-heading text-3xl md:text-4xl font-extrabold mt-2 capitalize flex items-center gap-2">
                  {STATUS_LABEL[today.status] || today.status.replace("_", " ")}
                  {today.under_review && <span className="text-xs bg-white/25 rounded-full px-2 py-1 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under review</span>}
                </div>
                <div className="text-xs mt-2 opacity-95 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {fmtDateTime(today.check_in_time)}</div>
                {today.location_label && <div className="text-xs mt-1 opacity-95">{today.location_label}</div>}
              </>
            ) : (
              <div className="font-heading text-3xl md:text-4xl font-extrabold mt-2 opacity-90">Not marked yet</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowCapture(true)} disabled={busy} className="bg-[#F97316] text-white hover:bg-[#EA580C] font-extrabold rounded-xl px-5 py-3 shadow active:scale-95 transition flex items-center gap-2" data-testid="mark-attendance-button">
              <Camera className="w-4 h-4" /> {today ? "Re-mark" : "Mark with Selfie"}
            </button>
          </div>
        </div>
        {today?.selfie_url && (
          <div className="relative mt-4 flex flex-wrap gap-3 items-center">
            <img src={today.selfie_url} alt="" className="w-20 h-20 rounded-xl object-cover ring-2 ring-[#F97316]" />
            {today.latitude != null && (
              <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/25">
                <MapPin className="w-3.5 h-3.5" />{today.latitude.toFixed(5)}, {today.longitude.toFixed(5)}
                {today.distance_m != null && <span className="opacity-90">· {fmtDistance(today.distance_m)} from office</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Calendar + office info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sk-card p-5 lg:col-span-2">
          <h2 className="font-heading text-lg font-extrabold mb-3 flex items-center gap-2"><span>📅</span> My month at a glance</h2>
          <AttendanceCalendar year={Y} month={M} records={me.filter(a => a.date.startsWith(`${Y}-${String(M).padStart(2, "0")}`))} />
        </div>
        <div className="sk-card p-5">
          <h2 className="font-heading text-lg font-extrabold mb-3 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#4DA3FF]" /> Office</h2>
          {settings ? (
            <div className="text-sm space-y-1.5 text-slate-700">
              <div className="font-bold">{settings.name}</div>
              {settings.address && <div className="text-xs text-slate-500">{settings.address}</div>}
              <div className="text-xs text-slate-500">In-time: <b>{(settings.office_in_time || "").slice(0, 5)}</b></div>
              <div className="text-xs text-slate-500">Late after: {settings.late_after_min}m · Half-day after: {settings.half_day_after_min}m · Absent after: {settings.absent_after_min}m</div>
            </div>
          ) : <div className="text-xs text-slate-400">Settings not loaded.</div>}
        </div>
      </div>

      {/* History */}
      <div className="sk-card p-5">
        <div className="font-heading font-extrabold mb-3">My history</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Check-in</th><th className="py-2 pr-4">Location</th><th className="py-2 pr-4">Selfie</th>
            </tr></thead>
            <tbody>
              {me.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No records yet</td></tr>}
              {me.map(a => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{a.date}</td>
                  <td className="py-2 pr-4">
                    <span className="sk-badge sk-badge-info"><StatusIcon s={a.status} />{STATUS_LABEL[a.status] || a.status.replace("_", " ")}</span>
                    {a.under_review && <span className="ml-1 sk-badge bg-amber-100 text-amber-800">review</span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{a.check_in_time ? fmtDateTime(a.check_in_time) : "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{a.location_label || (a.latitude != null ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "—")}</td>
                  <td className="py-2 pr-4">{a.selfie_url ? <a href={a.selfie_url} target="_blank" rel="noreferrer"><img src={a.selfie_url} className="w-9 h-9 rounded object-cover border" alt="" /></a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCapture && <SelfieCapture employeeName={user.name} onCapture={onCapture} onClose={() => setShowCapture(false)} />}
    </div>
  );
}
