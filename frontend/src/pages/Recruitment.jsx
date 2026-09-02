import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, Briefcase, CalendarDays, CheckCircle2, ChevronDown,
  Clock3, Download, ExternalLink, Filter, Mail, RefreshCw, Search, Sparkles,
  UserCheck, Users, XCircle, Eye, MoreVertical, TrendingUp, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { getRecruitmentDashboardStats, listApplications, listJobOpenings } from "@/lib/recruitment";

const ROYAL = "#0D47A1";
const ORANGE = "#FF6A00";

const STATUS_LABEL = {
  new: "New",
  shortlisted: "Shortlisted",
  interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed",
  selected: "Selected",
  rejected: "Rejected",
  on_hold: "On Hold",
  joining: "Joining Confirmed",
};

const STATUS_COLOR = {
  new: "#1976D2",
  shortlisted: ORANGE,
  interview_scheduled: "#7C4DFF",
  interviewed: "#0284C7",
  selected: "#10B981",
  rejected: "#64748B",
  on_hold: "#94A3B8",
  joining: "#059669",
};

const STATUS_ICON = {
  new: Users,
  shortlisted: UserCheck,
  interview_scheduled: CalendarDays,
  interviewed: UserRound,
  selected: CheckCircle2,
  rejected: XCircle,
  on_hold: Clock3,
  joining: CheckCircle2,
};

const fmtDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (value) => value ? new Date(`1970-01-01T${value}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Time not set";
const initials = (name = "?") => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
const relativeTime = (value) => {
  if (!value) return "—";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

function Card({ children, className = "", ...props }) {
  return <section className={`bg-white border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.045)] ${className}`} {...props}>{children}</section>;
}

function SectionTitle({ title, action }) {
  return <div className="flex items-center justify-between gap-3 mb-4">
    <h2 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>
    {action}
  </div>;
}

function Sparkline({ points = [], stroke = ROYAL }) {
  if (!points.length) return <div className="h-8" />;
  const max = Math.max(...points.map(p => Number(p) || 0), 1);
  const min = Math.min(...points.map(p => Number(p) || 0), 0);
  const range = Math.max(max - min, 1);
  const coords = points.map((p, i) => `${(i / Math.max(points.length - 1, 1)) * 100},${28 - (((Number(p) || 0) - min) / range) * 22}`).join(" ");
  return <svg viewBox="0 0 100 32" className="w-full h-8 overflow-visible" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function KpiCard({ title, value, icon: Icon, tone, note, points }) {
  return <Card className="p-4 min-w-0 overflow-hidden relative">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tone}12`, color: tone }}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 truncate">{title}</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{value ?? "—"}</div>
        </div>
      </div>
    </div>
    {note && <div className="text-[11px] text-slate-500 mt-2">{note}</div>}
    <div className="mt-2 -mx-1"><Sparkline points={points} stroke={tone} /></div>
  </Card>;
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || "#64748B";
  return <span className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ color, background: `${color}13` }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
    {STATUS_LABEL[status] || status}
  </span>;
}

function MiniBar({ value, total, color }) {
  const pct = total ? Math.max(2, Math.round((value / total) * 100)) : 0;
  return <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>;
}

function Donut({ data, total }) {
  const items = Object.entries(data).filter(([, value]) => Number(value) > 0);
  let offset = 0;
  const circumference = 2 * Math.PI * 42;
  return <div className="relative w-44 h-44 shrink-0">
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      <circle cx="50" cy="50" r="42" fill="none" stroke="#EEF2F7" strokeWidth="11" />
      {items.map(([status, value]) => {
        const len = (Number(value) / Math.max(total, 1)) * circumference;
        const dash = `${len} ${circumference - len}`;
        const node = <circle key={status} cx="50" cy="50" r="42" fill="none" stroke={STATUS_COLOR[status] || "#94A3B8"} strokeWidth="11" strokeDasharray={dash} strokeDashoffset={-offset} />;
        offset += len;
        return node;
      })}
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="text-2xl font-black text-slate-900 tabular-nums">{total}</div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</div>
    </div>
  </div>;
}

function TrendChart({ trends }) {
  if (!trends?.length) return <div className="h-48 flex items-center justify-center text-sm text-slate-400">Not enough application history yet.</div>;
  const values = trends.map(x => Number(x.count) || 0);
  const max = Math.max(...values, 1);
  const w = 620;
  const h = 190;
  const pad = 12;
  const coords = values.map((v, i) => `${pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)},${h - pad - (v / max) * (h - pad * 2)}`).join(" ");
  const area = `${pad},${h - pad} ${coords} ${w - pad},${h - pad}`;
  return <div className="w-full overflow-hidden">
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none" role="img" aria-label="Applications over the last 30 days">
      {[0, .25, .5, .75, 1].map((n) => <line key={n} x1={pad} x2={w - pad} y1={h - pad - n * (h - pad * 2)} y2={h - pad - n * (h - pad * 2)} stroke="#E2E8F0" strokeWidth="1" />)}
      <polygon points={area} fill="#0D47A1" opacity="0.07" />
      <polyline points={coords} fill="none" stroke={ROYAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
      <span>{fmtDate(trends[0]?.day)}</span><span>{fmtDate(trends[Math.floor(trends.length / 2)]?.day)}</span><span>{fmtDate(trends[trends.length - 1]?.day)}</span>
    </div>
  </div>;
}

export default function Recruitment() {
  const [rows, setRows] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [jobOpeningId, setJobOpeningId] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = async () => {
    setStatsLoading(true);
    try { setStats(await getRecruitmentDashboardStats()); }
    catch (e) { toast.error(e.message || "Failed to load recruitment dashboard"); }
    finally { setStatsLoading(false); }
  };

  const load = async () => {
    setLoading(true);
    try { setRows(await listApplications({ q, status, job_opening_id: jobOpeningId })); }
    catch (e) { toast.error(e.message || "Failed to load applications"); }
    finally { setLoading(false); }
  };

  useEffect(() => { listJobOpenings().then(setOpenings).catch(() => {}); loadStats(); }, []); // eslint-disable-line
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, jobOpeningId]); // eslint-disable-line

  const kpis = stats?.kpis || {};
  const statusCounts = stats?.status_counts || {};
  const trends = stats?.trends || [];
  const today = stats?.today || {};
  const upcoming = stats?.upcoming_interviews || [];
  const activity = stats?.recent_activity || [];
  const total = Number(kpis.total || 0);

  const trendPoints = useMemo(() => trends.map(x => Number(x.count) || 0), [trends]);
  const kpiTrend = trendPoints.length ? trendPoints.slice(-12) : [0, 0, 0, 0];

  const visibleRows = rows.slice(0, 8);

  const exportRows = () => {
    if (!rows.length) { toast.info("No applications available for the current filter"); return; }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Application No", "Candidate", "Email", "Phone", "Position", "Status", "Applied On", "Interview Date", "Interview Time"],
      ...rows.map(r => [r.application_number, r.name, r.email, r.phone, r.job_title, STATUS_LABEL[r.status] || r.status, r.applied_at, r.interview_date, r.interview_time]),
    ].map(row => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sankalp-recruitment-applications.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} application${rows.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="sk-page bg-slate-50/40 min-h-full">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: ORANGE }} /> Sankalp HRMS • Recruitment
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-black tracking-tight" style={{ color: ROYAL }}>Recruitment Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage applications, track candidate progress &amp; hire the best talent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/recruitment/openings" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-white text-sm font-bold shadow-sm hover:bg-slate-50 transition" style={{ borderColor: `${ROYAL}25`, color: ROYAL }}><Briefcase className="w-4 h-4" /> Job Openings</Link>
          <a href="/apply" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:brightness-105 transition" style={{ background: ORANGE }}><ExternalLink className="w-4 h-4" /> Public Form</a>
        </div>
      </div>

      <Card className="mt-5 p-3 md:p-4">
        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="sk-input pl-10 w-full bg-slate-50/70 border-slate-200" placeholder="Search name, email, phone, position or application ref…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select className="sk-input bg-slate-50/70 border-slate-200" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="sk-input bg-slate-50/70 border-slate-200 max-w-full sm:max-w-[250px]" value={jobOpeningId} onChange={e => setJobOpeningId(e.target.value)} aria-label="Filter by position">
              <option value="">All positions</option>
              {openings.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
            <button type="button" onClick={() => { load(); loadStats(); }} className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? "animate-spin" : ""}`} /> <span className="sm:hidden">Refresh</span>
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
        <KpiCard title="Total Applications" value={statsLoading ? "…" : kpis.total} icon={Users} tone="#1976D2" note="All submitted applications" points={kpiTrend} />
        <KpiCard title="New Applications" value={statsLoading ? "…" : kpis.new_count} icon={Briefcase} tone="#10B981" note="Currently awaiting review" points={kpiTrend} />
        <KpiCard title="Shortlisted" value={statsLoading ? "…" : kpis.shortlisted} icon={UserCheck} tone="#F59E0B" note="Ready for next step" points={kpiTrend} />
        <KpiCard title="Interviews Scheduled" value={statsLoading ? "…" : kpis.interviews_scheduled} icon={CalendarDays} tone="#7C4DFF" note="Currently scheduled" points={kpiTrend} />
        <KpiCard title="Selected / Hired" value={statsLoading ? "…" : kpis.selected_hired} icon={CheckCircle2} tone="#059669" note="Selected, joining or converted" points={kpiTrend} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] gap-4 mt-4">
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <SectionTitle title="Applications by Status" action={<select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-600 bg-white" defaultValue="30"><option value="30">Current pipeline</option></select>} />
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <Donut data={statusCounts} total={total} />
                <div className="flex-1 w-full space-y-2.5">
                  {Object.entries(STATUS_LABEL).map(([key, label]) => {
                    const value = Number(statusCounts[key] || 0);
                    const Icon = STATUS_ICON[key] || Activity;
                    return <button type="button" key={key} onClick={() => setStatus(status === key ? "" : key)} className={`w-full text-left group ${status === key ? "opacity-100" : ""}`}>
                      <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                        <span className="flex items-center gap-2 font-semibold text-slate-600"><Icon className="w-3.5 h-3.5" style={{ color: STATUS_COLOR[key] }} />{label}</span>
                        <span className="font-bold text-slate-800 tabular-nums">{value}</span>
                      </div>
                      <MiniBar value={value} total={total} color={STATUS_COLOR[key]} />
                    </button>;
                  })}
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle title="Applications Over Time" action={<span className="text-xs font-bold text-slate-400">Last 30 days</span>} />
              <TrendChart trends={trends} />
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><TrendingUp className="w-3.5 h-3.5" style={{ color: ROYAL }} /> Live application volume from submitted records</div>
            </Card>
          </div>

          <Card className="p-5">
            <SectionTitle title="Recruitment Pipeline" action={<span className="text-[11px] font-semibold text-slate-400">Current candidate distribution</span>} />
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
              {Object.entries(STATUS_LABEL).map(([key, label]) => {
                const value = Number(statusCounts[key] || 0);
                return <button type="button" key={key} onClick={() => setStatus(status === key ? "" : key)} className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${status === key ? "border-slate-400 shadow-sm" : "border-slate-100 bg-slate-50/50"}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${STATUS_COLOR[key]}13`, color: STATUS_COLOR[key] }}><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[key] }} /></div>
                  <div className="text-lg font-black text-slate-900 tabular-nums">{value}</div>
                  <div className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">{label}</div>
                </button>;
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SectionTitle title="Latest Applications" action={null} />
              <div className="flex items-center gap-2 -mt-3 sm:mt-0">
                <button type="button" onClick={exportRows} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"><Download className="w-3.5 h-3.5" /> Export</button>
                <button type="button" onClick={() => { setQ(""); setStatus(""); setJobOpeningId(""); }} className="text-xs font-bold" style={{ color: ROYAL }}>Clear filters</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="border-y border-slate-100 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-bold px-5 py-3">Candidate</th><th className="text-left font-bold px-3 py-3">Position</th><th className="text-left font-bold px-3 py-3">Status</th><th className="text-left font-bold px-3 py-3">Applied</th><th className="text-left font-bold px-3 py-3">Interview</th><th className="text-right font-bold px-5 py-3">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan="6" className="p-10 text-center text-slate-400">Loading applications…</td></tr> : visibleRows.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-slate-400">No applications match the current filters.</td></tr> : visibleRows.map(r => <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black text-white" style={{ background: STATUS_COLOR[r.status] || ROYAL }}>{initials(r.name)}</div><div className="min-w-0"><Link to={`/recruitment/${r.id}`} className="font-bold text-slate-800 hover:underline truncate block">{r.name}</Link><div className="text-[11px] text-slate-400 truncate">{r.email} • {r.phone}</div><div className="text-[10px] font-mono text-slate-300 mt-0.5">{r.application_number}</div></div></div></td>
                    <td className="px-3 py-3.5 text-xs font-semibold text-slate-600 max-w-[180px]">{r.job_title || "—"}</td>
                    <td className="px-3 py-3.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-3.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.applied_at)}</td>
                    <td className="px-3 py-3.5 text-xs text-slate-500 whitespace-nowrap">{r.interview_date ? <><div className="font-semibold text-slate-700">{fmtDate(r.interview_date)}</div><div>{fmtTime(r.interview_time)}</div></> : "—"}</td>
                    <td className="px-5 py-3.5"><div className="flex justify-end gap-1.5"><Link to={`/recruitment/${r.id}`} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50" title="View"><Eye className="w-4 h-4" /></Link><a href={`mailto:${r.email}`} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-blue-50" title="Email"><Mail className="w-4 h-4" /></a><button type="button" onClick={() => toast.info("Use Application Detail for more actions")} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50" title="More"><MoreVertical className="w-4 h-4" /></button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between"><span className="text-xs text-slate-400">Showing {visibleRows.length} of {rows.length} filtered applications</span><Link to="/recruitment" className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: ROYAL }}>View all applications <ArrowRight className="w-3.5 h-3.5" /></Link></div>
          </Card>
        </div>

        <aside className="space-y-4 min-w-0">
          <Card className="p-5">
            <SectionTitle title="TODAY — Intelligence" action={<Sparkles className="w-4 h-4" style={{ color: ORANGE }} />} />
            <div className="space-y-1">
              {[
                { icon: CalendarDays, color: "#7C4DFF", value: today.interviews_today, label: "Interviews starting today", action: () => setStatus("interview_scheduled") },
                { icon: Clock3, color: ORANGE, value: today.shortlisted_waiting, label: "Candidates waiting for action", action: () => setStatus("shortlisted") },
                { icon: CheckCircle2, color: "#059669", value: today.interviewed_pending_decision, label: "Interviewed — decision pending", action: () => setStatus("interviewed") },
                { icon: Briefcase, color: ROYAL, value: today.new_since_yesterday, label: "New applications since yesterday", action: () => setStatus("new") },
                { icon: UserCheck, color: "#F59E0B", value: today.shortlisted_not_scheduled, label: "Shortlisted but not scheduled", action: () => setStatus("shortlisted") },
              ].map((item, i) => <button type="button" key={i} onClick={item.action} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-left transition">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}12`, color: item.color }}><item.icon className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1"><div className="text-lg font-black text-slate-900 leading-none tabular-nums">{item.value ?? 0}</div><div className="text-[11px] text-slate-500 mt-1 leading-tight">{item.label}</div></div><ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              </button>)}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Quick Actions" />
            <div className="grid grid-cols-1 gap-2">
              <Link to="/recruitment/openings" className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold hover:bg-blue-100"><Briefcase className="w-4 h-4" /> Add / Manage Job Openings</Link>
              <button type="button" onClick={() => { setStatus("shortlisted"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-2.5 p-3 rounded-xl bg-orange-50 text-orange-800 text-xs font-bold hover:bg-orange-100"><CalendarDays className="w-4 h-4" /> Schedule Interview Queue</button>
              <button type="button" onClick={exportRows} className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100"><Download className="w-4 h-4" /> Export Current Applications</button>
              <a href="/apply" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100"><ExternalLink className="w-4 h-4" /> Open Public Application Form</a>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Upcoming Interviews" action={<button type="button" onClick={() => setStatus("interview_scheduled")} className="text-[11px] font-bold" style={{ color: ROYAL }}>View all →</button>} />
            {upcoming.length === 0 ? <div className="py-6 text-center text-xs text-slate-400">No upcoming interviews scheduled.</div> : <div className="divide-y divide-slate-100">{upcoming.slice(0, 5).map(item => <Link to={`/recruitment/${item.id}`} key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50 rounded-lg transition">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#7C4DFF12", color: "#7C4DFF" }}><CalendarDays className="w-4 h-4" /></div>
              <div className="min-w-0 flex-1"><div className="text-xs font-extrabold text-slate-800 truncate">{item.name}</div><div className="text-[10px] text-slate-500 truncate">{item.job_title || "Position"}</div><div className="text-[10px] font-semibold text-slate-400 mt-1">{fmtDate(item.interview_date)} • {fmtTime(item.interview_time)}</div></div>
            </Link>)}</div>}
          </Card>

          <Card className="p-5">
            <SectionTitle title="Recent Activity" action={<Activity className="w-4 h-4 text-slate-300" />} />
            {activity.length === 0 ? <div className="py-6 text-center text-xs text-slate-400">No activity recorded yet.</div> : <div className="space-y-3">{activity.slice(0, 6).map(item => <Link to={`/recruitment/${item.application_number ? item.id : ""}`} key={`${item.event_type}-${item.id}`} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0" style={{ color: ROYAL }}><Activity className="w-3.5 h-3.5" /></div>
              <div className="min-w-0"><div className="text-[11px] font-bold text-slate-700 leading-tight">{item.new_status ? `${item.name} moved to ${STATUS_LABEL[item.new_status] || item.new_status}` : `${item.name} application updated`}</div><div className="text-[10px] text-slate-400 mt-0.5">By {item.actor_name || "System"} • {relativeTime(item.event_at)}</div></div>
            </Link>)}</div>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
