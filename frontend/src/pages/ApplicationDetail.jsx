import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, FileText, UserPlus, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listEmployees } from "@/lib/data";
import {
  getApplication, getApplicationHistory, changeStatus, updateNotes, sendStatusEmail,
} from "@/lib/recruitment";

const STATUS_LABEL = {
  new: "New", shortlisted: "Shortlisted", interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed", selected: "Selected", rejected: "Rejected", on_hold: "On Hold",
};
// Which statuses email fires for — matches the approved plan (shortlist / interview / final decision)
const EMAIL_ON = new Set(["shortlisted", "interview_scheduled", "selected", "rejected"]);

export default function ApplicationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [app, setApp] = useState(null);
  const [history, setHistory] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [panel, setPanel] = useState(null); // 'interview' | 'outcome' | 'reject' | 'hold' | null
  const [iv, setIv] = useState({ interview_date: "", interview_time: "", interview_mode: "in_person", interviewer: "" });
  const [outcome, setOutcome] = useState({ interview_feedback: "", interview_rating: "" });
  const [reasonNote, setReasonNote] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getApplication(id), getApplicationHistory(id)])
      .then(([a, h]) => { setApp(a); setHistory(h); setNotes(a.hr_notes || ""); })
      .catch(() => toast.error("Failed to load application"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listEmployees({ status: "active" }).then(setInterviewers).catch(() => {}); }, []);

  const doChange = async (new_status, extra = {}) => {
    setBusy(true);
    try {
      await changeStatus({ application_id: id, new_status, ...extra });
      toast.success(`Status updated to ${STATUS_LABEL[new_status]}`);
      setPanel(null);
      load();
      if (EMAIL_ON.has(new_status)) {
        const r = await sendStatusEmail(id, new_status);
        if (r?.ok === false) toast.warning("Status updated, but the email failed to send. You can resend it below.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally { setBusy(false); }
  };

  const saveNotes = async () => {
    setBusy(true);
    try { await updateNotes(id, notes); toast.success("Notes saved"); }
    catch (err) { toast.error(err.message || "Failed to save notes"); }
    finally { setBusy(false); }
  };

  const goConvert = () => {
    nav("/employees/new", {
      state: {
        fromApplicationId: id,
        prefill: {
          name: app.name, email: app.email, phone: app.phone,
          photo_url: app.photo_url || "", address: app.current_address || "",
          designation: app.job_title || "",
        },
      },
    });
  };

  if (loading || !app) return <div className="sk-page text-slate-500">Loading…</div>;

  const canShortlist = app.status === "new";
  const canSchedule = ["shortlisted"].includes(app.status);
  const canMarkInterviewed = app.status === "interview_scheduled";
  const canDecide = app.status === "interviewed";
  const canRejectOrHold = !["selected", "rejected"].includes(app.status);
  const canConvert = app.status === "selected" && !app.converted_employee_id;

  return (
    <div className="sk-page max-w-3xl">
      <Link to="/recruitment" className="text-sm text-slate-600 inline-flex items-center gap-1.5 mb-3"><ArrowLeft className="w-4 h-4" /> Back</Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">{app.name}</h1>
          <div className="text-sm text-slate-500 font-mono">{app.application_number} • {app.job_title}</div>
        </div>
        <span className="sk-badge sk-badge-info">{STATUS_LABEL[app.status] || app.status}</span>
      </div>

      {app.converted_employee_id && (
        <div className="sk-card p-4 mt-4 bg-emerald-50 border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Converted to employee on {new Date(app.converted_at).toLocaleDateString()}.
        </div>
      )}

      <div className="sk-card p-5 mt-4 space-y-3">
        <div className="font-heading font-bold">Candidate Details</div>
        <div className="flex items-start gap-4">
          {app.photo_url ? <img src={app.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-xs">No photo</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm flex-1">
            <div><span className="text-slate-400">Email:</span> {app.email}</div>
            <div><span className="text-slate-400">Phone:</span> {app.phone}</div>
            <div><span className="text-slate-400">Experience:</span> {app.experience_years ?? "—"} yrs</div>
            <div><span className="text-slate-400">Current Company:</span> {app.current_company || "—"}</div>
            <div><span className="text-slate-400">Education:</span> {app.education || "—"}</div>
            <div><span className="text-slate-400">Expected Salary:</span> {app.expected_salary ? `₹${app.expected_salary}` : "—"}</div>
          </div>
        </div>
        {app.current_address && <div className="text-sm"><span className="text-slate-400">Address:</span> {app.current_address}</div>}
        {app.cover_note && <div className="text-sm"><span className="text-slate-400">Cover Note:</span> {app.cover_note}</div>}
        <a href={app.cv_url} target="_blank" rel="noreferrer" className="sk-btn-ghost inline-flex w-auto"><FileText className="w-4 h-4" /> View CV</a>
      </div>

      {(app.interview_date || app.interviewer_name) && (
        <div className="sk-card p-5 mt-4 space-y-1 text-sm">
          <div className="font-heading font-bold mb-1">Interview</div>
          <div><span className="text-slate-400">Date/Time:</span> {app.interview_date} {app.interview_time}</div>
          <div><span className="text-slate-400">Mode:</span> {app.interview_mode}</div>
          <div><span className="text-slate-400">Interviewer:</span> {app.interviewer_name || "—"}</div>
          {app.interview_feedback && <div><span className="text-slate-400">Feedback:</span> {app.interview_feedback}</div>}
          {app.interview_rating && <div><span className="text-slate-400">Rating:</span> {app.interview_rating}/5</div>}
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="sk-card p-5 mt-4 space-y-3">
        <div className="font-heading font-bold">Actions</div>
        <div className="flex flex-wrap gap-2">
          {canShortlist && <button disabled={busy} className="sk-btn-primary" onClick={() => doChange("shortlisted")}>Shortlist</button>}
          {canSchedule && <button disabled={busy} className="sk-btn-primary" onClick={() => setPanel("interview")}>Schedule Interview</button>}
          {canMarkInterviewed && <button disabled={busy} className="sk-btn-primary" onClick={() => setPanel("outcome")}>Mark Interviewed</button>}
          {canDecide && <button disabled={busy} className="sk-btn-accent" onClick={() => doChange("selected")}>Select</button>}
          {canRejectOrHold && <button disabled={busy} className="sk-btn-ghost" onClick={() => setPanel("reject")}>Reject</button>}
          {canRejectOrHold && <button disabled={busy} className="sk-btn-ghost" onClick={() => setPanel("hold")}>On Hold</button>}
          {canConvert && <button disabled={busy} className="sk-btn-accent" onClick={goConvert}><UserPlus className="w-4 h-4" /> Convert to Employee</button>}
          {EMAIL_ON.has(app.status) && (
            <button disabled={busy} className="sk-btn-ghost" onClick={async () => {
              const r = await sendStatusEmail(id, app.status);
              toast[r?.ok === false ? "error" : "success"](r?.ok === false ? "Resend failed" : "Email resent");
            }}><Mail className="w-4 h-4" /> Resend Email</button>
          )}
        </div>
        {app.last_email_error && (
          <div className="text-xs text-red-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Last email failed: {app.last_email_error}</div>
        )}

        {panel === "interview" && (
          <div className="border-t border-slate-100 pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Interview Date *"><input type="date" required className="sk-input" value={iv.interview_date} onChange={e => setIv({ ...iv, interview_date: e.target.value })} /></F>
            <F label="Interview Time *"><input type="time" required className="sk-input" value={iv.interview_time} onChange={e => setIv({ ...iv, interview_time: e.target.value })} /></F>
            <F label="Mode *"><select className="sk-input" value={iv.interview_mode} onChange={e => setIv({ ...iv, interview_mode: e.target.value })}>
              <option value="in_person">In Person</option><option value="phone">Phone</option><option value="video">Video</option></select></F>
            <F label="Interviewer *"><select className="sk-input" value={iv.interviewer} onChange={e => setIv({ ...iv, interviewer: e.target.value })}>
              <option value="">Select…</option>{interviewers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></F>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => setPanel(null)}>Cancel</button>
              <button disabled={busy || !iv.interview_date || !iv.interview_time || !iv.interviewer} className="sk-btn-primary"
                onClick={() => doChange("interview_scheduled", iv)}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Schedule</button>
            </div>
          </div>
        )}

        {panel === "outcome" && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Interview Feedback"><textarea rows={3} className="sk-input" value={outcome.interview_feedback} onChange={e => setOutcome({ ...outcome, interview_feedback: e.target.value })} /></F>
            <F label="Rating (1–5)"><input type="number" min="1" max="5" className="sk-input" value={outcome.interview_rating} onChange={e => setOutcome({ ...outcome, interview_rating: e.target.value })} /></F>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => setPanel(null)}>Cancel</button>
              <button disabled={busy} className="sk-btn-primary" onClick={() => doChange("interviewed", {
                interview_feedback: outcome.interview_feedback || null,
                interview_rating: outcome.interview_rating ? Number(outcome.interview_rating) : null,
              })}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save Outcome</button>
            </div>
          </div>
        )}

        {(panel === "reject" || panel === "hold") && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Note (optional)"><textarea rows={2} className="sk-input" value={reasonNote} onChange={e => setReasonNote(e.target.value)} /></F>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => { setPanel(null); setReasonNote(""); }}>Cancel</button>
              <button disabled={busy} className="sk-btn-primary" onClick={() => doChange(panel === "reject" ? "rejected" : "on_hold", { note: reasonNote || null })}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm {panel === "reject" ? "Reject" : "On Hold"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sk-card p-5 mt-4 space-y-3">
        <div className="font-heading font-bold">HR Notes</div>
        <textarea rows={3} className="sk-input" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="flex justify-end"><button disabled={busy} className="sk-btn-ghost" onClick={saveNotes}>Save Notes</button></div>
      </div>

      <div className="sk-card p-5 mt-4">
        <div className="font-heading font-bold mb-2">Status History</div>
        <div className="space-y-2 text-sm">
          {history.length === 0 ? <div className="text-slate-400">No changes yet.</div> : history.map(h => (
            <div key={h.id} className="flex justify-between border-b border-slate-50 pb-1.5">
              <div>{h.old_status ? `${STATUS_LABEL[h.old_status] || h.old_status} → ` : ""}{STATUS_LABEL[h.new_status] || h.new_status}
                {h.note && <span className="text-slate-400"> — {h.note}</span>}</div>
              <div className="text-slate-400 text-xs">{h.actor?.name || "—"} • {new Date(h.changed_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
