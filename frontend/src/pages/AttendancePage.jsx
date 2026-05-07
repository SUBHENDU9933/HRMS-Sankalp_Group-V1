import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import SelfieCapture from "@/components/SelfieCapture";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import {
  listAttendance, upsertAttendance, updateAttendance, deleteAttendance,
  listEmployees, uploadDataUrl, getCompanySettings,
} from "@/lib/data";
import { fmtDateTime, todayISO, getGPS } from "@/lib/utils-app";
import { haversineMeters, isInsideOffice, fmtDistance } from "@/lib/geo";
import { Camera, MapPin, CheckCircle2, AlertCircle, Clock, Trash2, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const Y = new Date().getFullYear();
const M = new Date().getMonth() + 1;

export default function AttendancePage() {
  const { user, isAdmin, isManager } = useAuth();
  const canAdmin = isAdmin || isManager;
  const [me, setMe] = useState([]);
  const [all, setAll] = useState([]);
  const [today, setToday] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [empId, setEmpId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [settings, setSettings] = useState(null);

  const loadMe = async () => {
    const rows = await listAttendance({ employee_id: user.id });
    setMe(rows);
    setToday(rows.find(a => a.date === todayISO()) || null);
  };
  const loadAll = async () => {
    if (!canAdmin) return;
    const rows = await listAttendance({ employee_id: empId || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined });
    setAll(rows);
  };

  useEffect(() => { if (user) { loadMe(); getCompanySettings().then(setSettings).catch(() => {}); } }, [user]); // eslint-disable-line
  useEffect(() => { if (canAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [canAdmin]);
  useEffect(() => { loadAll(); }, [empId, dateFrom, dateTo]); // eslint-disable-line

  /** Common save logic — handles geofence check for office attendance. */
  const saveAttendance = async ({ status, selfie_url, gps }) => {
    let underReview = false, distance = null, label = "🏢 @ Sankalp Office";
    if (settings) label = `🏢 @ ${settings.name || "Office"}`;

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

    await upsertAttendance({
      employee_id: user.id,
      date: todayISO(),
      status,
      selfie_url,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      notes: undefined,
    });
    // Now patch with extra fields (some may not exist in older DB; ignore failures gracefully)
    try {
      const justCreated = await listAttendance({ employee_id: user.id });
      const t = justCreated.find(a => a.date === todayISO());
      if (t) {
        await updateAttendance(t.id, {
          attendance_type: "office",
          location_label: label,
          distance_m: distance,
          under_review: underReview,
        });
      }
    } catch { /* schema not migrated yet */ }

    if (underReview) toast("Submitted for review (outside geofence)", { icon: "⚠️" });
    else toast.success("Attendance marked");
    await loadMe(); if (canAdmin) await loadAll();
  };

  const onCapture = async (dataUrl, gps) => {
    setShowCapture(false);
    setBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl, "attendance");
      await saveAttendance({ status: "present", selfie_url: url, gps });
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setBusy(false); }
  };
  const markStatus = async (status) => {
    setBusy(true);
    try {
      let gps = null; try { gps = await getGPS(); } catch {}
      await saveAttendance({ status, gps });
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };
  const updateStatus = async (id, status) => { await updateAttendance(id, { status }); toast.success("Updated"); await loadAll(); };
  const approve = async (id) => { await updateAttendance(id, { under_review: false, status: "present" }); toast.success("Approved"); await loadAll(); };
  const del = async (id) => { if (!window.confirm("Delete this record?")) return; await deleteAttendance(id); toast.success("Deleted"); await loadAll(); };

  const StatusIcon = ({ s }) => s === "present" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : s === "absent" ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <Clock className="w-4 h-4 text-amber-500" />;

  const reviewCount = canAdmin ? all.filter(a => a.under_review).length : 0;

  return (
    <div className="sk-page space-y-5" data-testid="attendance-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>✅</span> Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Selfie + GPS verified daily attendance with office geofence.</p>
      </div>

      {/* Today's strip — solid brand-blue */}
      <div className="relative rounded-2xl bg-[#1E3A8A] p-5 text-white shadow-md overflow-hidden" data-testid="today-card">
        <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-[#F97316]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-90">Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</div>
            {today ? (
              <>
                <div className="font-heading text-3xl md:text-4xl font-extrabold mt-2 capitalize flex items-center gap-2">
                  {today.status === "present" ? "✅" : today.status === "half_day" ? "🟡" : "🔴"} {today.status.replace("_", " ")}
                  {today.under_review && <span className="text-xs bg-white/25 backdrop-blur rounded-full px-2 py-1 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under review</span>}
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
            <button onClick={() => markStatus("half_day")} disabled={busy} className="bg-white text-[#1E3A8A] hover:bg-[#FFE4D0] font-bold rounded-xl px-3 py-2 text-sm">🟡 Half-day</button>
            <button onClick={() => markStatus("absent")} disabled={busy} className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl px-3 py-2 text-sm border border-white/30">🔴 Absent</button>
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

      {/* Calendar + summary */}
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
              <div className="text-xs text-slate-500">📍 {Number(settings.office_lat).toFixed(5)}, {Number(settings.office_lng).toFixed(5)}</div>
              <div className="text-xs text-slate-500">Geofence radius: <span className="font-bold text-slate-700">{settings.office_radius_m} m</span></div>
              <div className="text-xs text-slate-500">In-time: {(settings.office_in_time || "").slice(0,5)}</div>
            </div>
          ) : <div className="text-xs text-slate-400">Settings not loaded.</div>}
        </div>
      </div>

      {/* My history table */}
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
                    <span className={`sk-badge ${a.status === "present" ? "sk-badge-success" : a.status === "absent" ? "sk-badge-danger" : "sk-badge-warning"}`}><StatusIcon s={a.status} />{a.status.replace("_", " ")}</span>
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

      {canAdmin && (
        <div className="sk-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="font-heading font-extrabold flex items-center gap-2">
              👥 All attendance records
              {reviewCount > 0 && <span className="sk-badge bg-amber-100 text-amber-800">{reviewCount} pending review</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input w-auto">
                <option value="">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sk-input w-auto" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sk-input w-auto" />
            </div>
          </div>

          {/* Admin back-fill / edit-any-date form */}
          <AdminBackfillForm employees={employees} onSaved={loadAll} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Location</th><th className="py-2 pr-4">Selfie</th><th className="py-2 pr-4 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {all.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No records</td></tr>}
                {all.map(a => (
                  <tr key={a.id} className={`border-b border-slate-100 ${a.under_review ? "bg-amber-50/40" : ""}`}>
                    <td className="py-2 pr-4">{a.date}</td>
                    <td className="py-2 pr-4 font-semibold">{a.employee_name}</td>
                    <td className="py-2 pr-4">
                      <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)} className="sk-input w-auto py-1 text-xs">
                        <option value="present">Present</option><option value="half_day">Half-day</option><option value="absent">Absent</option>
                      </select>
                      {a.under_review && <div className="mt-1"><button onClick={() => approve(a.id)} className="text-[10px] font-bold text-emerald-600 hover:underline">Approve →</button></div>}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500">{a.location_label || (a.latitude != null ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "—")}{a.distance_m != null && <div className="opacity-70">{fmtDistance(a.distance_m)} from office</div>}</td>
                    <td className="py-2 pr-4">{a.selfie_url ? <a href={a.selfie_url} target="_blank" rel="noreferrer"><img src={a.selfie_url} className="w-9 h-9 rounded object-cover border" alt="" /></a> : "—"}</td>
                    <td className="py-2 pr-4 text-right">{isAdmin && <button onClick={() => del(a.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showCapture && <SelfieCapture employeeName={user.name} onCapture={onCapture} onClose={() => setShowCapture(false)} />}
    </div>
  );
}

/** Admin back-fill: add/edit attendance for any employee & any date (including past). */
function AdminBackfillForm({ employees, onSaved }) {
  const [form, setForm] = useState({ employee_id: "", date: todayISO(), status: "present", notes: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) { toast.error("Pick an employee"); return; }
    setBusy(true);
    try {
      const row = await upsertAttendance({
        employee_id: form.employee_id,
        date: form.date,
        status: form.status,
        notes: form.notes || null,
      });
      // Mark as office attendance, not under review (admin-entered = authoritative)
      try { await updateAttendance(row.id, { attendance_type: "office", under_review: false, location_label: "🏢 Admin-entered (back-fill)" }); } catch {}
      toast.success(`Saved — ${form.status.replace("_", " ")} on ${form.date}`);
      setForm({ ...form, notes: "" });
      onSaved();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="mb-4 p-4 rounded-xl bg-[#DBEAFE] border-2 border-[#4DA3FF]/30" data-testid="admin-backfill-form">
      <div className="text-xs font-extrabold uppercase tracking-wider text-[#4DA3FF] mb-2 flex items-center gap-1.5">✏️ Add / overwrite attendance (any date)</div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="sk-input md:col-span-2">
          <option value="">Select employee…</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="sk-input" />
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="sk-input">
          <option value="present">✅ Present</option>
          <option value="half_day">🟡 Half-day</option>
          <option value="absent">🔴 Absent</option>
          <option value="leave">🔵 Leave</option>
        </select>
        <button disabled={busy} className="sk-btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "+"} Save
        </button>
      </form>
      <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional, e.g. “migrated from paper register”)" className="sk-input mt-2" />
      <div className="text-[11px] text-slate-500 mt-2">Existing record on the same date for the same employee will be overwritten.</div>
    </div>
  );
}
