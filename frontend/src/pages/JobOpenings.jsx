import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listJobOpenings, saveJobOpening } from "@/lib/recruitment";

const ROYAL = "#0D47A1";
const ORANGE = "#FF6A00";
const empty = {
  id: null, title: "", department: "", status: "open", code: "",
  employment_type: "", experience_required: "", salary_range: "", location: "", work_type: "",
  description: "", responsibilities: "", skills: "", eligibility: "",
};

export default function JobOpenings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => listJobOpenings().then(setRows).catch(() => toast.error("Failed to load openings")).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveJobOpening(form);
      toast.success(form.id ? "Opening updated" : "Opening created");
      setForm(null);
      load();
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setBusy(false); }
  };

  const editRow = (r) => setForm({
    id: r.id, title: r.title, department: r.department || "", status: r.status, code: r.code || "",
    employment_type: r.employment_type || "", experience_required: r.experience_required || "",
    salary_range: r.salary_range || "", location: r.location || "", work_type: r.work_type || "",
    description: r.description || "", responsibilities: r.responsibilities || "",
    skills: r.skills || "", eligibility: r.eligibility || "",
  });

  return (
    <div className="sk-page max-w-3xl">
      <Link to="/recruitment" className="text-sm text-slate-600 inline-flex items-center gap-1.5 mb-3"><ArrowLeft className="w-4 h-4" /> Back to Recruitment</Link>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold" style={{ color: ROYAL }}>Job Openings</h1>
        <button className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }} onClick={() => setForm(empty)}><Plus className="w-4 h-4" /> New Opening</button>
      </div>

      {form && (
        <form onSubmit={save} className="sk-card p-5 space-y-5 mt-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Basic Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Title *"><input required className="sk-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></F>
              <F label="Job Code * (3-4 letters, used in application numbers)"><input required maxLength={4} className="sk-input uppercase" placeholder="e.g. RLE" value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></F>
              <F label="Department"><input className="sk-input" value={form.department || ""} onChange={e => setForm({ ...form, department: e.target.value })} /></F>
              <F label="Employment Type"><input className="sk-input" placeholder="e.g. Full Time, Freelancer / Flexible" value={form.employment_type || ""} onChange={e => setForm({ ...form, employment_type: e.target.value })} /></F>
              <F label="Experience Required"><input className="sk-input" placeholder="e.g. Freshers & Experienced, 1-5 Years" value={form.experience_required || ""} onChange={e => setForm({ ...form, experience_required: e.target.value })} /></F>
              <F label="Salary Range"><input className="sk-input" placeholder="e.g. ₹9,000 - ₹26,000 / Month" value={form.salary_range || ""} onChange={e => setForm({ ...form, salary_range: e.target.value })} /></F>
              <F label="Job Location"><input className="sk-input" placeholder="e.g. Chinar Park (Jyangra), Kolkata - 700059" value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} /></F>
              <F label="Work Type (optional)"><input className="sk-input" placeholder="e.g. Office + Field" value={form.work_type || ""} onChange={e => setForm({ ...form, work_type: e.target.value })} /></F>
              <F label="Status *"><select className="sk-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="open">Open for Joining</option><option value="closed">Closed</option></select></F>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Job Details</div>
            <div className="space-y-4">
              <F label="Job Description"><textarea rows={3} className="sk-input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></F>
              <F label="Key Responsibilities (one per line)"><textarea rows={5} className="sk-input" placeholder={"New client acquisition\nClient visits and meetings\n..."} value={form.responsibilities || ""} onChange={e => setForm({ ...form, responsibilities: e.target.value })} /></F>
              <F label="Skills Required (one per line, optional)"><textarea rows={4} className="sk-input" placeholder={"Strong SketchUp knowledge\nAutoCAD preferred\n..."} value={form.skills || ""} onChange={e => setForm({ ...form, skills: e.target.value })} /></F>
              <F label="Eligibility (one per line)"><textarea rows={4} className="sk-input" placeholder={"10th / 12th / Graduate\nGood communication skills\n..."} value={form.eligibility || ""} onChange={e => setForm({ ...form, eligibility: e.target.value })} /></F>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="sk-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            <button disabled={busy} className="sk-btn-primary" style={{ background: ROYAL, borderColor: ROYAL }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
          </div>
        </form>
      )}

      <div className="sk-card mt-5 divide-y divide-slate-100">
        {loading ? <div className="p-5 text-slate-500">Loading…</div> : rows.length === 0 ? <div className="p-5 text-slate-500">No openings yet.</div> : rows.map(r => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500">{r.department || "—"}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full text-white" style={{ background: r.status === "open" ? "#10B981" : "#94A3B8" }}>{r.status === "open" ? "Open for Joining" : "Closed"}</span>
              <button className="sk-btn-ghost" onClick={() => editRow(r)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
