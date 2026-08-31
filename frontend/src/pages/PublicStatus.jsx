import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle, Hash, Phone as PhoneIcon, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { toast } from "sonner";
import { LOGO } from "@/lib/utils-app";
import { checkApplicationStatus } from "@/lib/recruitment";

const ROYAL = "#0D47A1";
const ORANGE = "#FF6A00";

const STATUS_LABEL = {
  new: "New", shortlisted: "Shortlisted", interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed", selected: "Selected", rejected: "Not Selected", on_hold: "On Hold",
  joining: "Joining Confirmed",
};
const STATUS_COLOR = {
  new: "#1976D2", shortlisted: "#FF6A00", interview_scheduled: "#7C4DFF",
  interviewed: "#1976D2", selected: "#10B981", rejected: "#607D8B",
  on_hold: "#94A3B8", joining: "#10B981",
};

export default function PublicStatus() {
  const [form, setForm] = useState({ application_number: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const isEmail = (v) => v.includes("@");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setResult(null); setNotFound(false);
    try {
      const contact = form.contact.trim();
      const email = isEmail(contact) ? contact : null;
      const phone = isEmail(contact) ? null : contact;
      const r = await checkApplicationStatus(form.application_number, email, phone);
      if (!r) setNotFound(true); else setResult(r);
    } catch (err) {
      toast.error(err.message || "Lookup failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC] flex flex-col">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-[1160px] mx-auto px-5 py-3 flex items-center justify-between">
          <img src={LOGO} alt="Sankalp Group" className="h-10 object-contain" />
          <a href="/apply" className="text-sm font-semibold" style={{ color: ROYAL }}>← Back to Application</a>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, #0A2E6E 0%, ${ROYAL} 55%, #123E96 100%)` }}>
        <div className="absolute -top-10 -left-10 w-64 h-64 opacity-90 pointer-events-none" style={{
          background: `repeating-linear-gradient(-45deg, ${ROYAL} 0 26px, transparent 26px 30px, ${ORANGE} 30px 46px, transparent 46px 50px)`,
          maskImage: "linear-gradient(135deg, black 40%, transparent 75%)",
          WebkitMaskImage: "linear-gradient(135deg, black 40%, transparent 75%)",
        }} />
        <div className="relative max-w-[1160px] mx-auto px-5 py-10 md:py-14">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Check Application Status</h1>
          <p className="text-slate-200 text-sm mt-2 max-w-md">Track where your application stands, in real time.</p>
        </div>
      </section>

      <div className="max-w-md mx-auto px-5 -mt-8 flex-1 w-full">
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-4">
          <FI label="Application Number *">
            <div className="relative">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required placeholder="APP-2026-0001" className={inputCls} value={form.application_number} onChange={e => setForm({ ...form, application_number: e.target.value })} />
            </div>
          </FI>
          <FI label="Phone or Email *">
            <div className="relative">
              <PhoneIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required placeholder="Phone number or email address" className={inputCls} value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
            </div>
          </FI>
          <button disabled={busy} className="w-full h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70" style={{ background: `linear-gradient(90deg, ${ROYAL}, #1D5FC9)` }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Check Status</>}
          </button>
        </form>

        {notFound && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 mt-4 text-center text-sm text-slate-600 flex flex-col items-center gap-2">
            <XCircle className="w-8 h-8 text-slate-400" />
            No matching application found. Please double-check your application number and phone/email.
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold text-slate-800">{result.name}</div>
                <div className="text-xs text-slate-500 font-mono">{result.application_number} • {result.job_title}</div>
              </div>
              <span className="text-[11px] font-bold uppercase px-3 py-1 rounded-full text-white" style={{ background: STATUS_COLOR[result.status] || "#64748B" }}>
                {STATUS_LABEL[result.status] || result.status}
              </span>
            </div>

            {result.status === "interview_scheduled" && (
              <div className="text-sm bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                <div className="font-semibold text-xs text-slate-500 uppercase mb-1">Interview Details</div>
                <div><span className="text-slate-400">Date:</span> {result.interview_date}</div>
                <div><span className="text-slate-400">Time:</span> {result.interview_time}</div>
                <div><span className="text-slate-400">Mode:</span> {result.interview_mode}</div>
              </div>
            )}
            {result.status === "joining" && result.joining_date && (
              <div className="text-sm bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-slate-400">Joining Date:</span> {result.joining_date}
              </div>
            )}

            <div>
              <div className="font-semibold text-xs text-slate-500 uppercase mb-1.5">Submitted Application Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><span className="text-slate-400">Email:</span> {result.email}</div>
                <div><span className="text-slate-400">Phone:</span> {result.phone}</div>
                <div><span className="text-slate-400">Experience:</span> {result.experience_years ?? "—"} yrs</div>
                <div><span className="text-slate-400">Current Company:</span> {result.current_company || "—"}</div>
                <div><span className="text-slate-400">Education:</span> {result.education || "—"}</div>
                <div><span className="text-slate-400">Expected Salary:</span> {result.expected_salary ? `₹${result.expected_salary}` : "—"}</div>
              </div>
              {result.current_address && <div className="text-sm mt-1"><span className="text-slate-400">Address:</span> {result.current_address}</div>}
              {result.cover_note && <div className="text-sm mt-1"><span className="text-slate-400">Cover Note:</span> {result.cover_note}</div>}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-100"><CheckCircle2 className="w-3.5 h-3.5" /> Applied on {new Date(result.applied_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>

      <footer style={{ background: ROYAL }} className="text-white mt-10">
        <div className="max-w-[1160px] mx-auto px-5 py-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1.5"><img src={LOGO} alt="" className="h-8 object-contain" /></div>
              <div className="font-bold">Sankalp Group &amp; Business Solutions</div>
            </div>
            <div className="text-blue-100 text-xs mt-2 max-w-xs">Building inspiring spaces. Delivering trusted solutions.</div>
            <div className="flex gap-2 mt-3">
              {[Facebook, Instagram, Linkedin, Youtube].map((Icon, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-white grid place-items-center"><Icon className="w-3.5 h-3.5" style={{ color: ROYAL }} /></div>
              ))}
            </div>
          </div>
          <div className="text-xs text-blue-50 space-y-1">
            <div className="font-bold text-[11px] tracking-wider mb-1" style={{ color: ORANGE }}>CONTACT US</div>
            <div>Kolkata, West Bengal, India</div>
            <div>+91 97482 97025</div>
            <div>care.sankalpgrp@gmail.com</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
const inputCls = "w-full h-[52px] pl-10 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 text-sm transition bg-white";
const FI = ({ label, children }) => <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>{children}</div>;
