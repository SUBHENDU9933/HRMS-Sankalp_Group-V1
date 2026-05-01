import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listVisits } from "@/lib/data";
import { fmtDateTime } from "@/lib/utils-app";
import { Plus, MapPinned, Search } from "lucide-react";

export default function FieldVisits() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    listVisits({ visit_type: type || undefined, status: status || undefined })
      .then(setItems).finally(() => setLoading(false));
  }, [type, status]);

  const filtered = items.filter(v => {
    if (!q) return true;
    const text = ((v.lead_name || "") + " " + (v.project_name || "") + " " + (v.lead_location || "") + " " + (v.project_location || "") + " " + (v.employee_name || "")).toLowerCase();
    return text.includes(q.toLowerCase());
  });

  return (
    <div className="sk-page space-y-5" data-testid="visits-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Field Visits</h1>
          <p className="text-sm text-slate-500 mt-1">Verified site visits with selfie + GPS proof</p>
        </div>
        <Link to="/visits/new" className="sk-btn-accent" data-testid="add-visit-button"><Plus className="w-4 h-4" /> Add Visit</Link>
      </div>
      <div className="sk-card p-3 md:p-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search lead / project / employee" className="sk-input pl-9" data-testid="visit-search" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className="sk-input w-auto">
          <option value="">All Types</option>
          <option value="lead">Lead Visit</option>
          <option value="project">Project Visit</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="sk-input w-auto">
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="follow_up">Follow-up</option>
        </select>
      </div>
      {loading ? <div className="text-slate-500">Loading…</div> : filtered.length === 0 ? (
        <div className="sk-card p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 grid place-items-center mb-3"><MapPinned className="w-6 h-6 text-slate-400" /></div>
          <div className="font-semibold text-slate-700">No visits yet</div>
          <div className="text-sm text-slate-500 mt-1">Add your first field visit to get started</div>
          <Link to="/visits/new" className="sk-btn-primary mt-4 inline-flex"><Plus className="w-4 h-4" /> Add Visit</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <Link key={v.id} to={`/visits/${v.id}`} className="sk-card overflow-hidden hover:shadow-md transition group" data-testid={`visit-card-${v.id}`}>
              <div className="aspect-video bg-slate-100 relative">
                {v.selfie_url ? <img src={v.selfie_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-300"><MapPinned className="w-10 h-10" /></div>}
                <div className="absolute top-2 left-2 flex gap-2">
                  <span className={`sk-badge ${v.visit_type === "lead" ? "sk-badge-info" : "sk-badge-warning"}`}>{v.visit_type === "lead" ? "Lead" : "Project"}</span>
                  <span className={`sk-badge ${v.status === "completed" ? "sk-badge-success" : "sk-badge-warning"}`}>{v.status === "completed" ? "Done" : "Follow-up"}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="font-heading font-bold text-slate-900 truncate">{v.visit_type === "lead" ? (v.lead_name || "Lead Visit") : (v.project_name || "Project Visit")}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{v.visit_type === "lead" ? v.lead_location : v.project_location || "—"}</div>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                  <span>{v.employee_name}</span>
                  <span>{fmtDateTime(v.visit_date)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
