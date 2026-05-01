import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getDashboard } from "@/lib/data";
import { fmtINR, fmtDateTime, MONTHS } from "@/lib/utils-app";
import { Link } from "react-router-dom";
import { Users, ClipboardCheck, MapPinned, Wallet, ChevronRight, CheckCircle2, AlertCircle, Clock, Sparkles } from "lucide-react";

const Card = ({ icon: Icon, label, value, hint, color = "blue", testId }) => {
  const colors = { blue: "bg-blue-50 text-[#4DA3FF]", orange: "bg-orange-50 text-[#FFA94D]", green: "bg-green-50 text-green-600", red: "bg-red-50 text-red-500", purple: "bg-violet-50 text-violet-600" };
  return (
    <div className="sk-card p-5 hover:shadow-md transition-shadow" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="font-heading text-3xl font-extrabold text-slate-900 mt-1.5">{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${colors[color]} grid place-items-center`}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDashboard(user).then(setData).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="text-slate-500">Loading dashboard…</div>;
  if (!data) return <div className="text-slate-500">No data.</div>;

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="sk-page space-y-6" data-testid="dashboard">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{greeting},</div>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-slate-900">
            {user.name} <span className="font-bangla text-[#FFA94D]">👋</span>
          </h1>
          <div className="text-sm text-slate-500 mt-1">{today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div className="font-bangla text-sm text-slate-500 italic">"ঘর নয়, স্বপ্ন সাজাই আমরা"</div>
      </div>
      {data.role === "employee" ? <EmployeeDashboard data={data} /> : <AdminDashboard data={data} />}
    </div>
  );
}

function AdminDashboard({ data }) {
  const att = data.attendance_today || {};
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card testId="kpi-employees" icon={Users} label="Employees" value={data.total_employees} color="blue" hint="Active" />
        <Card testId="kpi-present-today" icon={CheckCircle2} label="Present Today" value={att.present || 0} color="green" hint={`${att.half_day || 0} half-day · ${att.absent || 0} absent`} />
        <Card testId="kpi-visits-today" icon={MapPinned} label="Visits Today" value={data.visits_today} color="orange" hint={`${data.visits_total} all time`} />
        <Card testId="kpi-payroll" icon={Wallet} label={`Payroll ${MONTHS[new Date().getMonth() + 1]}`} value={fmtINR(data.payroll_this_month)} color="purple" hint="Total net payable" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 sk-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Recent Field Visits</h2>
            <Link to="/visits" className="text-xs text-[#4DA3FF] font-semibold hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>
          </div>
          {data.recent_visits.length === 0 ? <EmptyState icon={MapPinned} label="No visits yet" /> : (
            <ul className="divide-y divide-slate-100">{data.recent_visits.map(v => (
              <li key={v.id}>
                <Link to={`/visits/${v.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition">
                  {v.selfie_url ? <img src={v.selfie_url} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-slate-100 grid place-items-center"><MapPinned className="w-5 h-5 text-slate-400" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{v.visit_type === "lead" ? v.lead_name : v.project_name || "Untitled"}</div>
                    <div className="text-xs text-slate-500">{v.employee_name} · {fmtDateTime(v.visit_date)}</div>
                  </div>
                  <span className={`sk-badge ${v.visit_type === "lead" ? "sk-badge-info" : "sk-badge-warning"}`}>{v.visit_type}</span>
                </Link>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="sk-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Expenses</h2>
            <span className="text-xs text-slate-400">This month</span>
          </div>
          <div className="font-heading text-3xl font-extrabold text-slate-900">{fmtINR(data.expenses_this_month)}</div>
          <div className="text-xs text-slate-500 mt-1">Total spent this month</div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-2">Visit mix</div>
            <div className="flex gap-2">
              <span className="sk-badge sk-badge-info">Lead: {data.visit_type_breakdown?.lead || 0}</span>
              <span className="sk-badge sk-badge-warning">Project: {data.visit_type_breakdown?.project || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function EmployeeDashboard({ data }) {
  const today = data.today_attendance;
  const att = data.attendance_summary || {};
  const pay = data.current_payroll;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="sk-card p-5" data-testid="my-today-attendance">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Today</div>
          {today ? (
            <>
              <div className="flex items-center gap-2">
                {today.status === "present" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {today.status === "absent" && <AlertCircle className="w-5 h-5 text-red-500" />}
                {today.status === "half_day" && <Clock className="w-5 h-5 text-amber-500" />}
                <span className="font-heading text-xl font-bold capitalize">{today.status.replace("_", " ")}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">{fmtDateTime(today.check_in_time)}</div>
            </>
          ) : (
            <>
              <div className="font-heading text-xl font-bold text-slate-400">Not marked</div>
              <Link to="/attendance" className="text-xs text-[#4DA3FF] font-semibold mt-2 inline-block">Mark attendance →</Link>
            </>
          )}
        </div>
        <Card icon={MapPinned} label="My Visits Today" value={data.visits_today} color="orange" hint={`${data.visits_this_month} this month`} />
        <Card icon={Wallet} label={`Salary — ${MONTHS[new Date().getMonth() + 1]}`} value={pay ? fmtINR(pay.net_salary) : "—"} color="purple" hint={pay ? "Net payable" : "Not generated yet"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sk-card p-5">
          <h2 className="font-heading text-lg font-bold mb-3">Attendance — this month</h2>
          <div className="grid grid-cols-3 gap-3">
            <SmallStat label="Present" value={att.present || 0} color="bg-green-100 text-green-700" />
            <SmallStat label="Half day" value={att.half_day || 0} color="bg-amber-100 text-amber-700" />
            <SmallStat label="Absent" value={att.absent || 0} color="bg-red-100 text-red-700" />
          </div>
        </div>
        <div className="lg:col-span-2 sk-card p-5">
          <h2 className="font-heading text-lg font-bold mb-3">My Recent Visits</h2>
          {data.recent_visits.length === 0 ? <EmptyState icon={MapPinned} label="No visits yet" /> : (
            <ul className="divide-y divide-slate-100">{data.recent_visits.map(v => (
              <li key={v.id}>
                <Link to={`/visits/${v.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition">
                  {v.selfie_url ? <img src={v.selfie_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{v.visit_type === "lead" ? v.lead_name : v.project_name || "Untitled"}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(v.visit_date)}</div>
                  </div>
                  <span className={`sk-badge ${v.visit_type === "lead" ? "sk-badge-info" : "sk-badge-warning"}`}>{v.visit_type}</span>
                </Link>
              </li>
            ))}</ul>
          )}
        </div>
      </div>
    </>
  );
}

const SmallStat = ({ label, value, color }) => (
  <div className={`rounded-lg p-3 ${color}`}>
    <div className="text-xs font-semibold opacity-80">{label}</div>
    <div className="font-heading text-2xl font-extrabold mt-0.5">{value}</div>
  </div>
);
const EmptyState = ({ icon: Icon, label }) => (
  <div className="text-center py-8">
    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 grid place-items-center mb-2"><Icon className="w-5 h-5 text-slate-400" /></div>
    <div className="text-sm text-slate-500">{label}</div>
  </div>
);
