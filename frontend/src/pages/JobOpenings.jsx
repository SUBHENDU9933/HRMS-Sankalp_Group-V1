import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listJobOpenings, saveJobOpening } from "@/lib/recruitment";

const empty = { id: null, title: "", department: "", description: "", status: "open" };

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

  return (
    <div className="sk-page max-w-3xl">
      <Link to="/recruitment" className="text-sm text-slate-600 inline-flex items-center gap-1.5 mb-3"><ArrowLeft className="w-4 h-4" /> Back to Recruitment</Link>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Job Openings</h1>
        <button className="sk-btn-primary" onClick={() => setForm(empty)}><Plus className="w-4 h-4" /> New Opening</button>
      </div>

      {form && (
        <form onSubmit={save} className="sk-card p-5 space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Title *"><input required className="sk-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></F>
            <F label="Department"><input className="sk-input" value={form.department || ""} onChange={e => setForm({ ...form, department: e.target.value })} /></F>
            <F label="Status"><select className="sk-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="open">Open</option><option value="closed">Closed</option></select></F>
          </div>
          <F label="Description"><textarea rows={3} className="sk-input" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></F>
          <div className="flex justify-end gap-2">
            <button type="button" className="sk-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            <button disabled={busy} className="sk-btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
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
              <span className={`sk-badge ${r.status === "open" ? "sk-badge-success" : "sk-badge-neutral"}`}>{r.status}</span>
              <button className="sk-btn-ghost" onClick={() => setForm({ id: r.id, title: r.title, department: r.department || "", description: r.description || "", status: r.status })}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
const F = ({ label, children }) => <div><label className="sk-label">{label}</label>{children}</div>;
