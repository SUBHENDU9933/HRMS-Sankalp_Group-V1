import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Briefcase, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { listApplications, listJobOpenings } from "@/lib/recruitment";

const STATUS_LABEL = {
  new: "New", shortlisted: "Shortlisted", interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed", selected: "Selected", rejected: "Rejected", on_hold: "On Hold",
};
const STATUS_BADGE = {
  new: "sk-badge-info", shortlisted: "sk-badge-warning", interview_scheduled: "sk-badge-warning",
  interviewed: "sk-badge-info", selected: "sk-badge-success", rejected: "sk-badge-danger", on_hold: "sk-badge-neutral",
};

export default function Recruitment() {
  const [rows, setRows] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listApplications({ q, status, job_opening_id: jobOpeningId })
      .then(setRows).catch(() => toast.error("Failed to load applications")).finally(() => setLoading(false));
  };
  useEffect(() => { listJobOpenings().then(setOpenings).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, jobOpeningId]); // eslint-disable-line

  return (
    <div className="sk-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Recruitment</h1>
        <div className="flex gap-2">
          <Link to="/recruitment/openings" className="sk-btn-ghost"><Briefcase className="w-4 h-4" /> Job Openings</Link>
          <a href="/apply" target="_blank" rel="noreferrer" className="sk-btn-accent"><ExternalLink className="w-4 h-4" /> Public Form</a>
        </div>
      </div>

      <div className="sk-card p-4 mt-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="sk-input pl-9" placeholder="Search name, email, phone, ref #…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="sk-input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="sk-input w-auto" value={jobOpeningId} onChange={e => setJobOpeningId(e.target.value)}>
          <option value="">All positions</option>
          {openings.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      </div>

      <div className="sk-card mt-4 divide-y divide-slate-100 overflow-x-auto">
        {loading ? <div className="p-5 text-slate-500">Loading…</div> : rows.length === 0 ? <div className="p-5 text-slate-500">No applications found.</div> : rows.map(r => (
          <Link to={`/recruitment/${r.id}`} key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{r.name} <span className="text-xs text-slate-400 font-mono">{r.application_number}</span></div>
              <div className="text-xs text-slate-500 truncate">{r.job_title} • {r.email} • {r.phone}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400 hidden md:block">{new Date(r.applied_at).toLocaleDateString()}</span>
              <span className={`sk-badge ${STATUS_BADGE[r.status] || "sk-badge-neutral"}`}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
