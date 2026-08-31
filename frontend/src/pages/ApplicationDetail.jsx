import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, FileText, UserPlus, Mail, AlertTriangle, MessageCircle, Repeat, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listEmployees } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import LocationMapTile from "@/components/LocationMapTile";
import {
  getApplication, getApplicationHistory, changeStatus, updateNotes, sendStatusEmail,
  listJobOpenings, reassignApplication, generateWhatsAppMessage, whatsappLink,
} from "@/lib/recruitment";

const ROYAL = "#0D47A1";
const ORANGE = "#FF6A00";
const STATUS_LABEL = {
  new: "New", shortlisted: "Shortlisted", interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed", selected: "Selected", rejected: "Rejected", on_hold: "On Hold",
  joining: "Joining Confirmed",
};
const STATUS_COLOR = {
  new: "#1976D2", shortlisted: ORANGE, interview_scheduled: "#7C4DFF",
  interviewed: "#1976D2", selected: "#10B981", rejected: "#64748B", on_hold: "#94A3B8", joining: "#10B981",
};
// Which statuses email/WhatsApp fire for
const EMAIL_ON = new Set(["shortlisted", "interview_scheduled", "selected", "rejected"]);
const WHATSAPP_ON = new Set(["shortlisted", "interview_scheduled", "selected", "rejected", "on_hold", "joining"]);

export default function ApplicationDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [app, setApp] = useState(null);
  const [history, setHistory] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [mapUrl, setMapUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [panel, setPanel] = useState(null); // 'interview' | 'outcome' | 'reject' | 'hold' | 'joining' | 'reassign' | null
  const [iv, setIv] = useState({ interview_date: "", interview_time: "", interview_mode: "in_person", interviewer: "" });
  const [outcome, setOutcome] = useState({ interview_feedback: "", interview_rating: "" });
  const [reasonNote, setReasonNote] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [reassignTo, setReassignTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getApplication(id), getApplicationHistory(id)])
      .then(([a, h]) => { setApp(a); setHistory(h); setNotes(a.hr_notes || ""); })
      .catch(() => toast.error("Failed to load application"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listEmployees({ status: "active" }).then(setInterviewers).catch(() => {}); }, []);
  useEffect(() => { listJobOpenings().then(setOpenings).catch(() => {}); }, []);
  useEffect(() => {
    supabase.from("company_settings").select("map_url").eq("id", "default").maybeSingle()
      .then(({ data }) => setMapUrl(data?.map_url || ""));
  }, []);

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

  const doReassign = async () => {
    if (!reassignTo) return;
    setBusy(true);
    try {
      await reassignApplication(id, reassignTo, reasonNote || null);
      toast.success("Application reassigned");
      setPanel(null); setReasonNote(""); setReassignTo("");
      load();
    } catch (err) { toast.error(err.message || "Reassign failed"); }
    finally { setBusy(false); }
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

  const openWhatsApp = () => {
    const msg = generateWhatsAppMessage(app, app.status, mapUrl);
    if (!msg) return;
    window.open(whatsappLink(app.phone, msg), "_blank");
  };

  if (loading || !app) return <div className="sk-page text-slate-500">Loading…</div>;

  const canShortlist = app.status === "new";
  const canSchedule = ["shortlisted"].includes(app.status);
  const canReschedule = app.status === "interview_scheduled";
  const canMarkInterviewed = app.status === "interview_scheduled";
  const canDecide = app.status === "interviewed";
  const canMarkJoining = app.status === "selected";
  const canRejectOrHold = !["selected", "rejected", "joining"].includes(app.status);
  const canReassign = app.status === "on_hold";
  const canConvert = app.status === "joining" && !app.converted_employee_id;

  return (
    <div className="sk-page max-w-3xl">
      <Link to="/recruitment" className="text-sm text-slate-600 inline-flex items-center gap-1.5 mb-3"><ArrowLeft className="w-4 h-4" /> Back</Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold" style={{ color: ROYAL }}>{app.name}</h1>
          <div className="text-sm text-slate-500 font-mono">{app.application_number} • {app.job_title}</div>
        </div>
        <span className="text-[11px] font-bold uppercase px-3 py-1.5 rounded-full text-white" style={{ background: STATUS_COLOR[app.status] || "#64748B" }}>Current Status: {STATUS_LABEL[app.status] || app.status}</span>
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

      {app.latitude != null && app.longitude != null && (
        <div className="sk-card p-5 mt-4">
          <div className="font-heading font-bold mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Location at Submission</div>
          <div className="flex items-start gap-4 flex-wrap">
            <LocationMapTile lat={app.latitude} lng={app.longitude} zoom={16} size={200} />
            <div className="text-sm space-y-1">
              <div><span className="text-slate-400">Coordinates:</span> {app.latitude.toFixed(6)}, {app.longitude.toFixed(6)}</div>
              {app.location_accuracy != null && <div><span className="text-slate-400">Accuracy:</span> ±{Math.round(app.location_accuracy)}m</div>}
              <a href={`https://www.google.com/maps?q=${app.latitude},${app.longitude}`} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: "#0D47A1" }}>Open in Google Maps</a>
            </div>
          </div>
        </div>
      )}

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

      {app.joining_date && (
        <div className="sk-card p-5 mt-4 text-sm">
          <div className="font-heading font-bold mb-1">Joining</div>
          <div><span className="text-slate-400">Joining Date:</span> {app.joining_date}</div>
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="sk-card p-5 mt-4 space-y-3">
        <div className="font-heading font-bold">Actions</div>
        <div className="flex flex-wrap gap-2">
          {canShortlist && <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => doChange("shortlisted")}>Shortlist</button>}
          {canSchedule && <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => setPanel("interview")}>Schedule Interview</button>}
          {canReschedule && <button disabled={busy} className="sk-btn-ghost" onClick={() => { setIv({ interview_date: app.interview_date || "", interview_time: app.interview_time || "", interview_mode: app.interview_mode || "in_person", interviewer: app.interviewer || "" }); setPanel("interview"); }}><Repeat className="w-4 h-4" /> Reschedule</button>}
          {canMarkInterviewed && <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => setPanel("outcome")}>Mark Interviewed</button>}
          {canDecide && <button disabled={busy} className="sk-btn-accent text-white" style={{ background: ORANGE, borderColor: ORANGE }} onClick={() => doChange("selected")}>Select</button>}
          {canMarkJoining && <button disabled={busy} className="sk-btn-accent text-white" style={{ background: ORANGE, borderColor: ORANGE }} onClick={() => setPanel("joining")}>Confirm Joining</button>}
          {canRejectOrHold && <button disabled={busy} className="sk-btn-ghost" onClick={() => setPanel("reject")}>Reject</button>}
          {canRejectOrHold && <button disabled={busy} className="sk-btn-ghost" onClick={() => setPanel("hold")}>On Hold</button>}
          {canReassign && <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => setPanel("reassign")}><Repeat className="w-4 h-4" /> Reassign to Another Role</button>}
          {canConvert && <button disabled={busy} className="sk-btn-accent text-white" style={{ background: ORANGE, borderColor: ORANGE }} onClick={goConvert}><UserPlus className="w-4 h-4" /> Convert to Employee</button>}
          {EMAIL_ON.has(app.status) && (
            <button disabled={busy} className="sk-btn-ghost" onClick={async () => {
              const r = await sendStatusEmail(id, app.status, true);
              toast[r?.ok === false ? "error" : "success"](r?.ok === false ? "Resend failed" : "Email resent");
              load();
            }}><Mail className="w-4 h-4" /> Resend Email</button>
          )}
          {WHATSAPP_ON.has(app.status) && (
            <button disabled={busy} className="sk-btn-ghost" onClick={openWhatsApp}><MessageCircle className="w-4 h-4" /> WhatsApp Message</button>
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
              <button disabled={busy || !iv.interview_date || !iv.interview_time || !iv.interviewer} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }}
                onClick={() => doChange("interview_scheduled", iv)}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm {canReschedule ? "Reschedule" : "Schedule"}</button>
            </div>
          </div>
        )}

        {panel === "outcome" && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Interview Feedback"><textarea rows={3} className="sk-input" value={outcome.interview_feedback} onChange={e => setOutcome({ ...outcome, interview_feedback: e.target.value })} /></F>
            <F label="Rating (1–5)"><input type="number" min="1" max="5" className="sk-input" value={outcome.interview_rating} onChange={e => setOutcome({ ...outcome, interview_rating: e.target.value })} /></F>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => setPanel(null)}>Cancel</button>
              <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => doChange("interviewed", {
                interview_feedback: outcome.interview_feedback || null,
                interview_rating: outcome.interview_rating ? Number(outcome.interview_rating) : null,
              })}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save Outcome</button>
            </div>
          </div>
        )}

        {panel === "joining" && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Joining Date *"><input type="date" required className="sk-input" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} /></F>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => { setPanel(null); setJoiningDate(""); }}>Cancel</button>
              <button disabled={busy || !joiningDate} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => doChange("joining", { joining_date: joiningDate })}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Joining
              </button>
            </div>
          </div>
        )}

        {panel === "reassign" && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Reassign To Position *"><select className="sk-input" value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
              <option value="">Select a position…</option>
              {openings.filter(o => o.id !== app.job_opening_id).map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select></F>
            <F label="Note (optional)"><textarea rows={2} className="sk-input" value={reasonNote} onChange={e => setReasonNote(e.target.value)} /></F>
            <div className="text-xs text-slate-500">This resets the application to "New" on the selected position — the candidate's original details, CV, and full history stay attached to this same application.</div>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => { setPanel(null); setReasonNote(""); setReassignTo(""); }}>Cancel</button>
              <button disabled={busy || !reassignTo} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={doReassign}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Reassign</button>
            </div>
          </div>
        )}

        {(panel === "reject" || panel === "hold") && (
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <F label="Note (optional)"><textarea rows={2} className="sk-input" value={reasonNote} onChange={e => setReasonNote(e.target.value)} /></F>
            <div className="flex justify-end gap-2">
              <button className="sk-btn-ghost" onClick={() => { setPanel(null); setReasonNote(""); }}>Cancel</button>
              <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => doChange(panel === "reject" ? "rejected" : "on_hold", { note: reasonNote || null })}>
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
