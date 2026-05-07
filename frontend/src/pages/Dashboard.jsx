import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  liveSalary, livePayrollTotal, listAttendance, listEmployees,
  listVisits, listExpenses, listPayroll
} from "@/lib/data";
import { fmtINR, fmtDateTime, MONTHS } from "@/lib/utils-app";
import { Link } from "react-router-dom";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import AdminAttendanceGrid from "@/components/AdminAttendanceGrid";
import MonthYearPicker from "@/components/MonthYearPicker";
import {
  Wallet, MapPinned, ChevronRight, Sparkles, TrendingUp, TrendingDown,
  Users, ClipboardCheck, Receipt, Coins, Trophy, ArrowUpRight
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const today = new Date();
const Y = today.getFullYear();
const M = today.getMonth() + 1;

export default function Dashboard() {
  const { user, isAdmin, isManager } = useAuth();
  if (!user) return null;
  const greet = today.getHours() < 12 ? "Good morning ☀️" : today.getHours() < 17 ? "Good afternoon 👋" : "Good evening 🌙";

  return (
    <div className="sk-page space-y-5 md:space-y-6" data-testid="dashboard">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4DA3FF] via-[#6BB6FF] to-[#FFA94D] p-5 md:p-7 text-white shadow-lg">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-[#F97316]/30 blur-2xl" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs md:text-sm font-medium opacity-90">{greet}</div>
            <h1 className="font-heading text-2xl md:text-4xl font-extrabold leading-tight mt-0.5">
              {user.name?.split(" ")[0] || "Hello"}
            </h1>
            <div className="text-xs md:text-sm opacity-90 mt-1">{today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
          <div className="font-bangla text-sm md:text-lg opacity-95 italic max-w-[60%] text-right">"ঘর নয়, স্বপ্ন সাজাই আমরা"</div>
        </div>
      </div>

      {(isAdmin || isManager) ? <AdminBlock /> : <EmployeeBlock userId={user.id} />}
    </div>
  );
}

/* ---------------- EMPLOYEE ---------------- */
function EmployeeBlock({ userId }) {
  const [period, setPeriod] = useState({ year: Y, month: M });
  const [salary, setSalary] = useState(null);
  const [att, setAtt] = useState([]);
  const [visits, setVisits] = useState({ today: 0, month: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pad = String(period.month).padStart(2, "0");
      const monthStart = `${period.year}-${pad}-01`;
      const next = new Date(period.year, period.month, 1).toISOString().slice(0, 10);
      const todayISO = today.toISOString().slice(0, 10);
      const [sal, attRows, visMonth, visToday] = await Promise.all([
        liveSalary(userId, period.year, period.month),
        listAttendance({ employee_id: userId, date_from: monthStart, date_to: next }),
        listVisits({ employee_id: userId, date_from: monthStart, date_to: next }),
        listVisits({ employee_id: userId, date_from: todayISO }),
      ]);
      if (cancelled) return;
      setSalary(sal);
      setAtt(attRows);
      setVisits({ today: visToday.length, month: visMonth.length });
    })();
    return () => { cancelled = true; };
  }, [userId, period.year, period.month]);

  return (
    <>
      {/* Month/year picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Viewing period</div>
        <MonthYearPicker value={period} onChange={setPeriod} />
      </div>

      {/* LIVE salary HERO */}
      <LiveSalaryHero salary={salary} title={`🪙 My Salary · ${MONTHS[period.month]} ${period.year}`} subtitle={period.year === Y && period.month === M ? "Live till today — auto-calculated from attendance & ledger" : "Full-month summary"} />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile icon="✅" label="Present" value={salary?.present_days || 0} hint={`${MONTHS[period.month]} ${period.year}`} color="emerald" />
        <StatTile icon="🟡" label="Half-day" value={salary?.half_days || 0} hint={`${MONTHS[period.month]} ${period.year}`} color="amber" />
        <StatTile icon="📍" label="Visits today" value={visits.today} hint={`${visits.month} in period`} color="orange" />
        <StatTile icon="💸" label="Advance" value={fmtINR(salary?.advance || 0)} hint="outstanding" color="rose" />
      </div>

      {/* Calendar + recent visits side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sk-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-extrabold flex items-center gap-2"><span>📅</span> Attendance — {MONTHS[period.month]} {period.year}</h2>
          </div>
          <AttendanceCalendar year={period.year} month={period.month} records={att} />
        </div>
        <RecentVisitsCard userId={userId} />
      </div>
    </>
  );
}

/* ---------------- ADMIN / MANAGER ---------------- */
function AdminBlock() {
  const [agg, setAgg] = useState(null);
  const [empCount, setEmpCount] = useState(0);
  const [visits, setVisits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [topPerf, setTopPerf] = useState([]);
  const [pay, setPay] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const monthStart = new Date(Y, M - 1, 1).toISOString().slice(0, 10);
      const [a, emps, vAll, exp, payAll] = await Promise.all([
        livePayrollTotal(Y, M).catch(() => null),
        listEmployees({ status: "active" }).catch(() => []),
        listVisits({ date_from: monthStart }).catch(() => []),
        listExpenses({ date_from: monthStart }).catch(() => []),
        listPayroll({ year: Y, month: M }).catch(() => []),
      ]);
      if (cancelled) return;
      setAgg(a);
      setEmpCount(emps.length);
      setVisits(vAll);
      setExpenses(exp);
      setPay(payAll);

      // Top performers by visits in this month
      const byEmp = {};
      vAll.forEach(v => {
        const k = v.employee_id;
        if (!k) return;
        byEmp[k] = byEmp[k] || { id: k, name: v.employee_name || "—", count: 0 };
        byEmp[k].count++;
      });
      setTopPerf(Object.values(byEmp).sort((a, b) => b.count - a.count).slice(0, 5));
    })();
    return () => { cancelled = true; };
  }, []);

  // Visits trend last 14 days
  const visitsTrend = (() => {
    const arr = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const c = visits.filter(v => (v.visit_date || "").slice(0, 10) === key).length;
      arr.push({ d: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), v: c });
    }
    return arr;
  })();
  const expByCat = (() => {
    const m = {};
    expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + (e.amount || 0); });
    return Object.entries(m).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 6);
  })();
  const PIE_COLORS = ["#4DA3FF", "#FFA94D", "#22C55E", "#A855F7", "#EF4444", "#0EA5E9"];

  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <>
      {/* Admin live total payroll HERO */}
      <LiveSalaryHero
        salary={{
          base_salary: agg?.total_base, allowance: agg?.total_allowance,
          deductions: (agg?.total_deductions || 0) + (agg?.total_advance || 0),
          advance: agg?.total_advance, net_live: agg?.total_net,
          present_days: null, half_days: null,
        }}
        title={`💰 Total Payroll So Far · ${MONTHS[M]} ${Y}`}
        subtitle={`Live across ${agg?.employee_count || empCount} active employees`}
        admin
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile icon="👥" label="Employees" value={empCount} hint="active" color="blue" />
        <StatTile icon="📍" label="Visits" value={visits.length} hint="this month" color="orange" />
        <StatTile icon="💸" label="Expenses" value={fmtINR(totalSpent)} hint="this month" color="rose" />
        <StatTile icon="🧾" label="Generated payslips" value={pay.length} hint={MONTHS[M]} color="violet" />
      </div>

      {/* Team attendance grid */}
      <div className="sk-card p-5">
        <AdminAttendanceGrid days={14} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sk-card p-5 lg:col-span-2">
          <h2 className="font-heading text-lg font-extrabold flex items-center gap-2 mb-3"><span>📈</span> Visits trend — last 14 days</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={visitsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="v" stroke="#4DA3FF" strokeWidth={3} dot={{ r: 4, fill: "#FFA94D" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sk-card p-5">
          <h2 className="font-heading text-lg font-extrabold flex items-center gap-2 mb-3"><span>🍩</span> Expense by category</h2>
          {expByCat.length === 0 ? (
            <div className="h-56 grid place-items-center text-slate-400 text-sm">No expenses yet</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expByCat} dataKey="value" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {expByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {expByCat.map((e, i) => (
              <span key={e.name} className="inline-flex items-center gap-1 text-slate-600">
                <span className="w-2 h-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {e.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Top performers + recent visits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="sk-card p-5">
          <h2 className="font-heading text-lg font-extrabold flex items-center gap-2 mb-3"><Trophy className="w-5 h-5 text-[#FFA94D]" /> Top performers</h2>
          {topPerf.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">No visits this month</div> : (
            <ul className="space-y-2">
              {topPerf.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold text-white ${i === 0 ? "bg-[#FFA94D]" : i === 1 ? "bg-slate-400" : "bg-slate-300"}`}>{i + 1}</span>
                  <div className="flex-1 truncate font-semibold text-slate-800 text-sm">{t.name}</div>
                  <span className="sk-badge sk-badge-info">{t.count} visits</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 sk-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-extrabold flex items-center gap-2"><MapPinned className="w-5 h-5 text-[#4DA3FF]" /> Recent visits</h2>
            <Link to="/visits" className="text-xs text-[#4DA3FF] font-bold hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>
          </div>
          {visits.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">No visits this month</div> : (
            <ul className="divide-y divide-slate-100">
              {visits.slice(0, 5).map(v => (
                <li key={v.id}>
                  <Link to={`/visits/${v.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition">
                    {v.selfie_url ? <img src={v.selfie_url} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-slate-100 grid place-items-center"><MapPinned className="w-5 h-5 text-slate-400" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{v.visit_type === "lead" ? v.lead_name : v.project_name || "Untitled"}</div>
                      <div className="text-xs text-slate-500">{v.employee_name} · {fmtDateTime(v.visit_date)}</div>
                    </div>
                    <span className={`sk-badge ${v.visit_type === "lead" ? "sk-badge-info" : "sk-badge-warning"}`}>{v.visit_type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- shared bits ---------------- */
function LiveSalaryHero({ salary, title, subtitle, admin }) {
  const net = salary?.net_live || 0;
  const base = salary?.base_salary || 0;
  const add  = salary?.allowance || 0;
  const adv  = salary?.advance || 0;
  const ded  = salary?.deductions || 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-[0_10px_30px_-10px_rgba(77,163,255,0.25)]" data-testid="live-salary-hero">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#FFA94D]/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-[#4DA3FF]/10 blur-2xl" />
      <div className="relative p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#4DA3FF]">{title}</div>
            <div className="font-heading text-3xl md:text-5xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {fmtINR(net)}
            </div>
            <div className="text-xs md:text-sm text-slate-500 mt-1.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#FFA94D]" /> {subtitle}</div>
          </div>
          {!admin && (salary?.present_days != null) && (
            <div className="hidden md:block text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Days</div>
              <div className="font-heading text-2xl font-extrabold text-emerald-600">{salary.present_days || 0}<span className="text-slate-300 text-lg">/{(salary.present_days || 0) + (salary.half_days || 0) + (salary.absent_days || 0)}</span></div>
              <div className="text-[10px] text-slate-400">present this month</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Breakdown icon={<Coins className="w-4 h-4" />} label="Base" value={base} positive />
          <Breakdown icon={<TrendingUp className="w-4 h-4" />} label="Allowance" value={add} positive />
          <Breakdown icon={<TrendingDown className="w-4 h-4" />} label="Advance" value={adv} negative />
          <Breakdown icon={<TrendingDown className="w-4 h-4" />} label="Deductions" value={ded} negative />
        </div>
        <Link to="/ledger" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#4DA3FF] hover:text-[#3B82F6]">
          See ledger <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

const Breakdown = ({ icon, label, value, positive, negative }) => (
  <div className={`rounded-xl p-3 ${positive ? "bg-emerald-50" : negative ? "bg-rose-50" : "bg-slate-50"}`}>
    <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-slate-600"}`}>
      {icon} {label}
    </div>
    <div className={`font-heading text-base md:text-lg font-extrabold mt-0.5 ${positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-slate-800"}`}>
      {negative ? "−" : positive ? "+" : ""}{fmtINR(value)}
    </div>
  </div>
);

const TILE_COLOR = {
  emerald: "from-emerald-50 to-white text-emerald-700",
  amber:   "from-amber-50 to-white text-amber-700",
  orange:  "from-orange-50 to-white text-orange-700",
  rose:    "from-rose-50 to-white text-rose-700",
  blue:    "from-blue-50 to-white text-blue-700",
  violet:  "from-violet-50 to-white text-violet-700",
};

const StatTile = ({ icon, label, value, hint, color = "blue" }) => (
  <div className={`relative overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br ${TILE_COLOR[color] || TILE_COLOR.blue} p-3.5 md:p-4`}>
    <div className="flex items-start justify-between">
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl md:text-2xl">{icon}</div>
    </div>
    <div className="font-heading text-2xl md:text-3xl font-extrabold text-slate-900 mt-1.5">{value}</div>
    {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

function RecentVisitsCard({ userId }) {
  const [visits, setVisits] = useState([]);
  useEffect(() => { listVisits({ employee_id: userId }).then(rows => setVisits(rows.slice(0, 5))).catch(() => {}); }, [userId]);
  return (
    <div className="sk-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg font-extrabold flex items-center gap-2"><MapPinned className="w-5 h-5 text-[#4DA3FF]" /> My visits</h2>
        <Link to="/visits" className="text-xs text-[#4DA3FF] font-bold hover:underline">All →</Link>
      </div>
      {visits.length === 0 ? <div className="text-sm text-slate-400 py-6 text-center">No visits yet</div> : (
        <ul className="space-y-2.5">
          {visits.map(v => (
            <li key={v.id}>
              <Link to={`/visits/${v.id}`} className="flex items-center gap-2.5 hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg">
                {v.selfie_url ? <img src={v.selfie_url} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg bg-slate-100" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{v.visit_type === "lead" ? v.lead_name : v.project_name || "Untitled"}</div>
                  <div className="text-[10px] text-slate-500">{fmtDateTime(v.visit_date)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
