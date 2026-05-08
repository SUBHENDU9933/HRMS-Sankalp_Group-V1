import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCompanySettings, updateCompanySettings, uploadFile } from "@/lib/data";
import { Building2, MapPin, Clock, Save, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export default function CompanySettings() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCompanySettings().then(setData).finally(() => setLoading(false)); }, []);

  const setField = (k, v) => setData(d => ({ ...d, [k]: v }));

  const onLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const url = await uploadFile(f, "branding");
      setField("logo_url", url);
      toast.success("Logo uploaded");
    } catch { toast.error("Upload failed"); }
  };

  const useMyGPS = () => {
    if (!navigator.geolocation) return toast.error("GPS not available");
    navigator.geolocation.getCurrentPosition(
      (p) => { setField("office_lat", p.coords.latitude); setField("office_lng", p.coords.longitude); toast.success("Office GPS captured"); },
      () => toast.error("Could not get GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const patch = { ...data };
      // keep TIME fields HH:MM:SS
      ["office_in_time", "office_out_time"].forEach(k => {
        if (patch[k] && /^\d{2}:\d{2}$/.test(patch[k])) patch[k] += ":00";
      });
      ["office_lat", "office_lng"].forEach(k => { if (patch[k] !== "" && patch[k] != null) patch[k] = Number(patch[k]); });
      ["office_radius_m", "late_after_min", "half_day_after_min", "absent_after_min"].forEach(k => { if (patch[k] !== "" && patch[k] != null) patch[k] = parseInt(patch[k], 10); });
      delete patch.id; delete patch.updated_at;
      const updated = await updateCompanySettings(patch);
      setData(updated);
      toast.success("Company settings saved");
    } catch (e) { toast.error(e.message || "Save failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;
  if (!data) return <div className="text-slate-500">No settings found.</div>;
  if (!isAdmin) return <div className="text-slate-500">Admins only.</div>;

  const t = (s) => (s || "").slice(0, 5); // HH:MM

  return (
    <div className="sk-page space-y-5 max-w-4xl" data-testid="company-settings-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><Building2 className="w-6 h-6 text-[#4DA3FF]" /> Company Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Branding, geofence and attendance rules.</p>
      </div>

      {/* Branding */}
      <Card title="🏢 Branding & Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company name *">
            <input value={data.name || ""} onChange={e => setField("name", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Tagline">
            <input value={data.tagline || ""} onChange={e => setField("tagline", e.target.value)} className="sk-input font-bangla" />
          </Field>
          <Field label="Email">
            <input type="email" value={data.email || ""} onChange={e => setField("email", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Phone">
            <input value={data.phone || ""} onChange={e => setField("phone", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Website">
            <input value={data.website || ""} onChange={e => setField("website", e.target.value)} className="sk-input" placeholder="https://example.com" />
          </Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {data.logo_url ? <img src={data.logo_url} alt="" className="w-14 h-14 rounded-lg object-contain bg-slate-50 border" /> : <div className="w-14 h-14 rounded-lg bg-slate-50 border grid place-items-center text-[10px] text-slate-400">No logo</div>}
              <label className="sk-btn-ghost cursor-pointer"><Upload className="w-4 h-4" /> Upload<input type="file" accept="image/*" onChange={onLogo} className="hidden" /></label>
            </div>
          </Field>
        </div>
        <Field label="Address">
          <textarea rows={2} value={data.address || ""} onChange={e => setField("address", e.target.value)} className="sk-input" />
        </Field>
      </Card>

      {/* Geofence */}
      <Card title="📍 Office Geofence" hint="Employees can only mark office attendance inside this radius. Outside attendance is submitted for admin review.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Latitude">
            <input type="number" step="0.0000001" value={data.office_lat ?? ""} onChange={e => setField("office_lat", e.target.value)} className="sk-input font-mono" />
          </Field>
          <Field label="Longitude">
            <input type="number" step="0.0000001" value={data.office_lng ?? ""} onChange={e => setField("office_lng", e.target.value)} className="sk-input font-mono" />
          </Field>
          <Field label="Radius (metres)">
            <input type="number" min="10" max="5000" step="10" value={data.office_radius_m ?? 100} onChange={e => setField("office_radius_m", e.target.value)} className="sk-input" />
          </Field>
        </div>
        <button type="button" onClick={useMyGPS} className="sk-btn-ghost mt-3"><MapPin className="w-4 h-4 text-[#FFA94D]" /> Use my current GPS</button>
      </Card>

      {/* Timing */}
      <Card title="🕘 Timing rules" hint="Strictly enforced on punch-in. Employees: status auto-set based on punch time. Only admin can override afterwards.">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Office in-time">
            <input type="time" value={t(data.office_in_time) || "09:30"} onChange={e => setField("office_in_time", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Office out-time">
            <input type="time" value={t(data.office_out_time) || "18:30"} onChange={e => setField("office_out_time", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Late after (min)">
            <input type="number" value={data.late_after_min ?? 30} onChange={e => setField("late_after_min", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Half-day after (min)">
            <input type="number" value={data.half_day_after_min ?? 60} onChange={e => setField("half_day_after_min", e.target.value)} className="sk-input" />
          </Field>
          <Field label="Absent after (min)">
            <input type="number" value={data.absent_after_min ?? 120} onChange={e => setField("absent_after_min", e.target.value)} className="sk-input" />
          </Field>
        </div>
        {/* Live rule preview */}
        <RulePreview data={data} />
      </Card>

      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className="sk-btn-primary" data-testid="company-save-button">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings
        </button>
      </div>
    </div>
  );
}

const Card = ({ title, hint, children }) => (
  <div className="sk-card p-5 space-y-4">
    <div>
      <div className="font-heading font-extrabold text-base">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <div>
    <div className="sk-label">{label}</div>
    {children}
  </div>
);

/** Live preview showing exactly which window each status applies to (in IST AM/PM). */
function RulePreview({ data }) {
  const inT = (data.office_in_time || "09:30").slice(0, 5);
  const late = parseInt(data.late_after_min ?? 30, 10);
  const half = parseInt(data.half_day_after_min ?? 60, 10);
  const absent = parseInt(data.absent_after_min ?? 120, 10);
  const fmt = (mins) => {
    const [h, m] = inT.split(":").map(Number);
    const d = new Date(); d.setHours(h || 9, (m || 30) + mins, 0, 0);
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  };
  return (
    <div className="rounded-xl bg-[#DBEAFE] border-2 border-[#4DA3FF]/30 p-4 mt-2">
      <div className="text-xs font-extrabold uppercase tracking-wider text-[#1E3A8A] mb-2">📋 Live rule preview (IST)</div>
      <ul className="text-xs space-y-1.5 text-slate-800">
        <li><span className="font-bold text-emerald-700">✅ Present</span> — punch in {fmt(0)} to {fmt(late)} ({inT} + {late} min grace)</li>
        <li><span className="font-bold text-rose-600">🕒 Late</span> (still counted as present) — punch in {fmt(late + 1)} to {fmt(half)}</li>
        <li><span className="font-bold text-amber-600">🟡 Half-day</span> — punch in {fmt(half + 1)} to {fmt(absent)}</li>
        <li><span className="font-bold text-red-700">🔴 Absent + Under Review</span> — after {fmt(absent)}. Admin must approve before 8:00 PM, else auto-finalised as Absent.</li>
      </ul>
    </div>
  );
}
