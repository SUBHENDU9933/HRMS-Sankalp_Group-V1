import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  getTrackingDashboard, startTrackingShift, endTrackingShift, recordTrackingLocation,
} from "@/lib/tracking";
import {
  MapPinned, Clock3, ShieldCheck, RefreshCw, LogIn, LogOut,
  AlertTriangle, LoaderCircle, ExternalLink, Users, MapPin,
} from "lucide-react";
import { toast } from "sonner";

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("এই ডিভাইসে GPS / location সুবিধা নেই।"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      }),
      err => reject(new Error(
        err.code === 1 ? "Location permission দিন, তারপর আবার চেষ্টা করুন।" :
        err.code === 2 ? "বর্তমানে অবস্থান পাওয়া যাচ্ছে না। GPS চালু করে আবার চেষ্টা করুন।" :
        "Location পেতে সময় শেষ হয়েছে। আবার চেষ্টা করুন।"
      )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function osmUrl(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
}

function MigrationNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-900">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <div className="font-bold">Tracking database এখনও চালু করা হয়নি</div>
        <p className="text-sm mt-1">এই feature-এর database migration এখনও প্রয়োগ করা হয়নি। তাই কোনো tracking action চলবে না। Production database নিরাপদ রাখতে আগে migration review ও অনুমোদিত rollout প্রয়োজন।</p>
      </div>
    </div>
  );
}

function EmployeeTracking({ user }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [siteLabel, setSiteLabel] = useState("");
  const [error, setError] = useState("");
  const [schemaReady, setSchemaReady] = useState(false);
  const lastPingAt = useRef(null);

  const loadShift = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("tracking_shifts")
      .select("id, site_label, checked_in_at, checked_out_at")
      .eq("employee_id", user.id)
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queryError) {
      setSchemaReady(false);
      setError(queryError.message || "Tracking service is not ready.");
      setShift(null);
    } else {
      setSchemaReady(true);
      setShift(data || null);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { loadShift(); }, [loadShift]);

  useEffect(() => {
    if (!shift?.id) return undefined;
    let stopped = false;
    const ping = async () => {
      try {
        const pos = await getCurrentPosition();
        if (stopped) return;
        await recordTrackingLocation({
          shiftId: shift.id,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
        });
        lastPingAt.current = new Date().toISOString();
      } catch (e) {
        if (!stopped) setError(e.message || "Location update failed.");
      }
    };
    // The page visibly indicates active tracking. Browser tracking runs only while this page is open.
    ping();
    const id = window.setInterval(ping, 60000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [shift?.id]);

  const checkIn = async () => {
    setBusy(true); setError("");
    try {
      const pos = await getCurrentPosition();
      const created = await startTrackingShift({
        siteLabel: siteLabel.trim() || null,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
      const row = Array.isArray(created) ? created[0] : created;
      setShift(row);
      toast.success("ডিউটি শুরু হয়েছে। Location tracking সক্রিয়।");
    } catch (e) {
      const message = e.message || "Check-in করা যায়নি।";
      setError(message);
      toast.error(message);
    } finally { setBusy(false); }
  };

  const checkOut = async () => {
    if (!shift?.id) return;
    setBusy(true); setError("");
    try {
      let pos = null;
      try { pos = await getCurrentPosition(); } catch {}
      await endTrackingShift({
        shiftId: shift.id,
        latitude: pos?.latitude ?? null,
        longitude: pos?.longitude ?? null,
      });
      setShift(null);
      toast.success("ডিউটি শেষ হয়েছে। Location tracking বন্ধ।");
    } catch (e) {
      const message = e.message || "Check-out করা যায়নি।";
      setError(message);
      toast.error(message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="sk-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">Employee shift</p>
            <h2 className="font-heading text-2xl font-extrabold mt-1">নমস্কার, {user.name || "Employee"}</h2>
            <p className="text-sm text-slate-500 mt-1">ডিউটি শুরু/শেষ করার জন্য এখানে check-in করুন।</p>
          </div>
          <span className={`sk-badge ${shift ? "sk-badge-warning" : "sk-badge-info"}`}>
            {shift ? "Tracking active" : "Not checked in"}
          </span>
        </div>
        {shift && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 font-bold text-emerald-800"><MapPin className="w-4 h-4" /> আপনার tracking সক্রিয়</div>
            <p className="text-sm text-emerald-800 mt-1">এই পেজ খোলা থাকলে প্রতি ৬০ সেকেন্ডে location update করার চেষ্টা হবে। এটি background tracking নয়; Android APK-তে আলাদা foreground tracking ব্যবস্থা প্রয়োজন হবে।</p>
            <p className="text-xs text-emerald-700 mt-2">Check-in: {formatDateTime(shift.checked_in_at)}{lastPingAt.current ? ` · Last update: ${formatDateTime(lastPingAt.current)}` : ""}</p>
          </div>
        )}
        {!shift && (
          <label className="block mt-5">
            <span className="block text-sm font-semibold text-slate-700 mb-1.5">Site / কাজের জায়গা (ঐচ্ছিক)</span>
            <input value={siteLabel} onChange={e => setSiteLabel(e.target.value)} maxLength={120} placeholder="যেমন: Customer site / Project name" className="sk-input w-full" />
          </label>
        )}
        {error && <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">{error}</div>}
      {error && (error.includes("tracking_shifts") || error.includes("start_tracking_shift") || error.includes("record_employee_location") || error.includes("does not exist")) && <MigrationNotice />}
        <div className="mt-5 flex flex-wrap gap-3">
          {!shift ? (
            <button onClick={checkIn} disabled={busy || loading || !schemaReady} className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A8A] text-white px-5 py-3 font-bold disabled:opacity-50">
              {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} ডিউটি শুরু / Check in
            </button>
          ) : (
            <button onClick={checkOut} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] text-white px-5 py-3 font-bold disabled:opacity-50">
              {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} ডিউটি শেষ / Check out
            </button>
          )}
          <button onClick={loadShift} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>
      <div className="flex gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 shrink-0" /> GPS কেবল ডিউটি শুরু করার পর ব্যবহৃত হবে। ফোনে Location permission দিতে হবে এবং tracking চালু থাকলে তা এখানে স্পষ্ট দেখানো হবে।</div>
      {!schemaReady && !loading && <p className="text-xs text-amber-800">Database feature ready না হওয়া পর্যন্ত check-in button বন্ধ থাকবে; location permission চাওয়া হবে না।</p>}
    </div>
  );
}

function ManagerTracking() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await getTrackingDashboard();
      setRows(data);
    } catch (e) {
      setError(e.message || "Tracking dashboard unavailable.");
      setRows([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    reload();
    const id = window.setInterval(reload, 60000);
    return () => window.clearInterval(id);
  }, [reload]);

  return (
    <div className="space-y-5">
      <div className="sk-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A]">Manager view</p>
            <h2 className="font-heading text-2xl font-extrabold mt-1">Employee live tracking</h2>
            <p className="text-sm text-slate-500 mt-1">শুধু বর্তমানে check-in করা কর্মীদের সর্বশেষ পাওয়া অবস্থান।</p>
          </div>
          <button onClick={reload} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
        {error && <div className="mt-4"><MigrationNotice /><p className="text-xs text-slate-500 mt-2">Technical detail: {error}</p></div>}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4"><Users className="w-5 h-5 text-[#1E3A8A]" /><div className="text-2xl font-extrabold mt-2">{rows.length}</div><div className="text-xs text-slate-500">Active tracked shifts</div></div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4"><MapPinned className="w-5 h-5 text-[#F97316]" /><div className="text-2xl font-extrabold mt-2">{rows.filter(r => r.last_latitude != null && r.last_longitude != null).length}</div><div className="text-xs text-slate-500">Locations received</div></div>
        </div>
      </div>
      <div className="sk-card p-5">
        <h3 className="font-heading text-lg font-extrabold mb-3">Currently on duty</h3>
        {loading ? <div className="py-8 text-center text-slate-400"><LoaderCircle className="w-5 h-5 animate-spin inline mr-2" />Loading…</div> :
          rows.length === 0 ? <div className="py-8 text-center text-slate-500 text-sm">কোনও active tracking shift পাওয়া যায়নি।</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="py-3 pr-3">Employee</th><th className="py-3 pr-3">Category</th><th className="py-3 pr-3">Site</th><th className="py-3 pr-3">Check-in</th><th className="py-3 pr-3">Last location</th></tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.shift_id} className="border-b border-slate-100">
                    <td className="py-3 pr-3"><div className="font-bold">{r.employee_name || "Employee"}</div><div className="text-xs text-slate-500">{r.employee_code || r.employee_id}</div></td>
                    <td className="py-3 pr-3 text-xs">{r.employment_type || "Not set"} / {r.worker_category || "Not set"}</td>
                    <td className="py-3 pr-3">{r.site_label || "—"}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">{formatDateTime(r.checked_in_at)}</td>
                    <td className="py-3 pr-3">{r.last_latitude == null ? <span className="text-slate-400">Waiting for GPS</span> : <><div className="font-mono text-xs">{Number(r.last_latitude).toFixed(5)}, {Number(r.last_longitude).toFixed(5)}</div><div className="text-xs text-slate-500">{formatDateTime(r.captured_at)}</div><a href={osmUrl(r.last_latitude, r.last_longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A8A] mt-1">Open map <ExternalLink className="w-3 h-3" /></a></>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </div>
      <p className="text-xs text-slate-500 flex gap-2"><Clock3 className="w-4 h-4 shrink-0" /> Dashboard refreshes every 60 seconds while open. OpenStreetMap links do not require a paid map API key; map data attribution applies.</p>
    </div>
  );
}

export default function TrackingPage() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  return (
    <div className="sk-page space-y-5" data-testid="tracking-page">
      <div className="relative rounded-2xl bg-[#1E3A8A] p-5 md:p-6 text-white overflow-hidden">
        <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-[#F97316]" />
        <div className="flex items-center gap-3"><MapPinned className="w-8 h-8 text-[#FFA94D]" /><div><h1 className="font-heading text-2xl md:text-3xl font-extrabold">Sankalp Employee Tracking</h1><p className="text-sm text-white/80 mt-1">Shift check-in, check-out and transparent location updates</p></div></div>
      </div>
      {isManager ? <ManagerTracking /> : <EmployeeTracking user={user} />}
    </div>
  );
}
