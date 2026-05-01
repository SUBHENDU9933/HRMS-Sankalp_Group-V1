import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import SelfieCapture from "@/components/SelfieCapture";
import { listAttendance, upsertAttendance, updateAttendance, deleteAttendance, listEmployees, uploadDataUrl } from "@/lib/data";
import { fmtDateTime, todayISO, getGPS } from "@/lib/utils-app";
import { Camera, MapPin, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => { if (user) loadMe(); }, [user]);
  useEffect(() => { if (canAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [canAdmin]);
  useEffect(() => { loadAll(); }, [empId, dateFrom, dateTo]);

  const onCapture = async (dataUrl, gps) => {
    setShowCapture(false);
    setBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl, "attendance");
      await upsertAttendance({ employee_id: user.id, date: todayISO(), status: "present", selfie_url: url, latitude: gps?.latitude, longitude: gps?.longitude });
      toast.success("Attendance marked");
      await loadMe(); if (canAdmin) await loadAll();
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setBusy(false); }
  };
  const markStatus = async (status) => {
    setBusy(true);
    try {
      let gps = null; try { gps = await getGPS(); } catch {}
      await upsertAttendance({ employee_id: user.id, date: todayISO(), status, latitude: gps?.latitude, longitude: gps?.longitude });
      toast.success("Marked " + status.replace("_", " "));
      await loadMe();
    } catch { toast.error("Failed"); }
    finally { setBusy(false); }
  };
  const updateStatus = async (id, status) => { await updateAttendance(id, { status }); toast.success("Updated"); await loadAll(); };
  const del = async (id) => { if (!window.confirm("Delete this record?")) return; await deleteAttendance(id); toast.success("Deleted"); await loadAll(); };

  const StatusIcon = ({ s }) => s === "present" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : s === "absent" ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-amber-500" />;

  return (
    <div className="sk-page space-y-5" data-testid="attendance-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Selfie + GPS verified daily attendance</p>
      </div>
      <div className="sk-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</div>
            {today ? (
              <div className="mt-2 flex items-center gap-2"><StatusIcon s={today.status} /><span className="font-heading text-2xl font-extrabold capitalize">{today.status.replace("_", " ")}</span><span className="text-xs text-slate-500">at {fmtDateTime(today.check_in_time)}</span></div>
            ) : <div className="font-heading text-2xl font-extrabold text-slate-400 mt-2">Not marked yet</div>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowCapture(true)} disabled={busy} className="sk-btn-accent" data-testid="mark-attendance-button"><Camera className="w-4 h-4" /> {today ? "Re-mark" : "Mark with Selfie"}</button>
            <button onClick={() => markStatus("half_day")} disabled={busy} className="sk-btn-ghost text-amber-600 border-amber-200">Half-day</button>
            <button onClick={() => markStatus("absent")} disabled={busy} className="sk-btn-ghost text-red-600 border-red-200">Absent</button>
          </div>
        </div>
        {today?.selfie_url && (
          <div className="mt-4 flex gap-3 items-center">
            <img src={today.selfie_url} alt="" className="w-20 h-20 rounded-lg object-cover border" />
            {today.latitude != null && <span className="gps-pill"><MapPin className="w-3.5 h-3.5 text-[#FFA94D]" />{today.latitude.toFixed(5)}, {today.longitude.toFixed(5)}</span>}
          </div>
        )}
      </div>
      <div className="sk-card p-5">
        <div className="font-heading font-bold mb-3">My History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Check-in</th><th className="py-2 pr-4">Selfie</th><th className="py-2 pr-4">GPS</th>
            </tr></thead>
            <tbody>
              {me.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No records yet</td></tr>}
              {me.map(a => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{a.date}</td>
                  <td className="py-2 pr-4"><span className={`sk-badge ${a.status === "present" ? "sk-badge-success" : a.status === "absent" ? "sk-badge-danger" : "sk-badge-warning"}`}><StatusIcon s={a.status} />{a.status.replace("_", " ")}</span></td>
                  <td className="py-2 pr-4 text-slate-500">{a.check_in_time ? fmtDateTime(a.check_in_time) : "—"}</td>
                  <td className="py-2 pr-4">{a.selfie_url ? <a href={a.selfie_url} target="_blank" rel="noreferrer"><img src={a.selfie_url} className="w-9 h-9 rounded object-cover border" alt="" /></a> : "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500 font-mono">{a.latitude != null ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {canAdmin && (
        <div className="sk-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="font-heading font-bold">All Attendance Records</div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input w-auto">
                <option value="">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sk-input w-auto" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sk-input w-auto" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">GPS</th><th className="py-2 pr-4">Selfie</th><th className="py-2 pr-4 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {all.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No records</td></tr>}
                {all.map(a => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{a.date}</td>
                    <td className="py-2 pr-4 font-medium">{a.employee_name}</td>
                    <td className="py-2 pr-4">
                      <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)} className="sk-input w-auto py-1 text-xs">
                        <option value="present">Present</option><option value="half_day">Half-day</option><option value="absent">Absent</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500 font-mono">{a.latitude != null ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : "—"}</td>
                    <td className="py-2 pr-4">{a.selfie_url ? <a href={a.selfie_url} target="_blank" rel="noreferrer"><img src={a.selfie_url} className="w-9 h-9 rounded object-cover border" alt="" /></a> : "—"}</td>
                    <td className="py-2 pr-4 text-right">{isAdmin && <button onClick={() => del(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>}</td>
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
