import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LOGO } from "@/lib/utils-app";
import { checkApplicationStatus } from "@/lib/recruitment";

const STATUS_LABEL = {
  new: "New", shortlisted: "Shortlisted", interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed", selected: "Selected", rejected: "Not Selected", on_hold: "On Hold",
  joining: "Joining Confirmed",
};
const STATUS_BADGE = {
  new: "sk-badge-info", shortlisted: "sk-badge-warning", interview_scheduled: "sk-badge-warning",
  interviewed: "sk-badge-info", selected: "sk-badge-success", rejected: "sk-badge-danger",
  on_hold: "sk-badge-neutral", joining: "sk-badge-success",
};

export default function PublicStatus() {
  const [form, setForm] = useState({ application_number: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setResult(null); setNotFound(false);
    try {
      const r = await checkApplicationStatus(form.application_number, form.email, form.phone);
      if (!r) setNotFound(true); else setResult(r);
    } catch (err) {
      toast.error(err.message || "Lookup failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-slate-900 grid place-items-center overflow-hidden shrink-0">
            <img src={LOGO} alt="Sankalp" className="w-full h-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-extrabold text-slate-900">Sankalp Interior Solution</div>
            <div className="text-xs text-slate-500 -mt-0.5">Check Application Status</div>
          </div>
        </div>

        <form onSubmit={submit} className="sk-card p-5 space-y-4">
          <F label="Application Number *"><input required placeholder="APP-2026-0001" className="sk-input" value={form.application_number} onChange={e => setForm({ ...form, application_number: e.target.value })} /></F>
          <F label="Email *"><input type="email" required className="sk-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></F>
          <F label="Phone *"><input required className="sk-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></F>
          <button disabled={busy} className="sk-btn-primary w-full">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Check Status</button>
        </form>

        {notFound && (
          <div className="sk-card p-5 mt-4 text-center text-sm text-slate-600 flex flex-col items-center gap-2">
            <XCircle className="w-8 h-8 text-slate-400" />
            No matching application found. Please double-check your application number, email, and phone.
          </div>
        )}

        {result && (
          <div className="sk-card p-5 mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-heading font-bold">{result.name}</div>
                <div className="text-xs text-slate-500 font-mono">{result.application_number} • {result.job_title}</div>
              </div>
              <span className={`sk-badge ${STATUS_BADGE[result.status] || "sk-badge-neutral"}`}>{STATUS_LABEL[result.status] || result.status}</span>
            </div>
            {result.status === "interview_scheduled" && (
              <div className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
                <div><span className="text-slate-400">Interview Date:</span> {result.interview_date}</div>
                <div><span className="text-slate-400">Time:</span> {result.interview_time}</div>
                <div><span className="text-slate-400">Mode:</span> {result.interview_mode}</div>
              </div>
            )}
            {result.status === "joining" && result.joining_date && (
              <div className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="text-slate-400">Joining Date:</span> {result.joining_date}
              </div>
            )}
            <div className="text-xs text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Applied on {new Date(result.applied_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
