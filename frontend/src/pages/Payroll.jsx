import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtINR, MONTHS } from "@/lib/utils-app";
import { Wallet, Download, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Payroll() {
  const { user, isAdmin } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genFor, setGenFor] = useState(null);
  const [genIncentive, setGenIncentive] = useState(0);
  const [genBonus, setGenBonus] = useState(0);
  const [genOvertime, setGenOvertime] = useState(0);
  const [genExtraDed, setGenExtraDed] = useState(0);
  const [genNotes, setGenNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await api.get("/payroll", { params: { month, year } });
    setList(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year]);

  useEffect(() => {
    if (isAdmin) api.get("/employees", { params: { status: "active" } }).then(r => setEmployees(r.data));
  }, [isAdmin]);

  const generate = async (e) => {
    e.preventDefault();
    if (!genFor) return;
    setBusy(true);
    try {
      await api.post("/payroll/generate", {
        employee_id: genFor,
        month,
        year,
        incentive: Number(genIncentive || 0),
        bonus: Number(genBonus || 0),
        overtime: Number(genOvertime || 0),
        extra_deductions: Number(genExtraDed || 0),
        notes: genNotes,
      });
      toast.success("Payroll generated");
      setGenFor(null); setGenIncentive(0); setGenBonus(0); setGenOvertime(0); setGenExtraDed(0); setGenNotes("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (pid) => {
    const token = localStorage.getItem("sk_token");
    const res = await fetch(`${API_BASE}/payroll/${pid}/payslip`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error("Download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip_${pid}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sk-page space-y-5" data-testid="payroll-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Payroll</h1>
          <p className="text-sm text-slate-500 mt-1">Monthly salary processing with attendance auto-calculation</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="sk-input w-auto" data-testid="month-picker">
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="sk-input w-auto" data-testid="year-picker">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Generate form */}
      {isAdmin && (
        <form onSubmit={generate} className="sk-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#FFA94D]" />
            <div className="font-heading font-bold">Generate / Update Payroll for {MONTHS[month]} {year}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select required value={genFor || ""} onChange={e => setGenFor(e.target.value)} className="sk-input md:col-span-2" data-testid="gen-employee">
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="number" placeholder="Incentive" value={genIncentive} onChange={e => setGenIncentive(e.target.value)} className="sk-input" />
            <input type="number" placeholder="Bonus" value={genBonus} onChange={e => setGenBonus(e.target.value)} className="sk-input" />
            <input type="number" placeholder="Overtime" value={genOvertime} onChange={e => setGenOvertime(e.target.value)} className="sk-input" />
            <input type="number" placeholder="Extra deduction" value={genExtraDed} onChange={e => setGenExtraDed(e.target.value)} className="sk-input" />
          </div>
          <div className="mt-3 flex gap-2">
            <input value={genNotes} onChange={e => setGenNotes(e.target.value)} placeholder="Notes (optional)" className="sk-input flex-1" />
            <button disabled={busy} className="sk-btn-primary" data-testid="generate-payroll">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Generate
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">Auto-pulls present/half/absent days from attendance + advance/deduction from ledger.</div>
        </form>
      )}

      {/* Table */}
      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#4DA3FF]" />
          <div className="font-heading font-bold">{MONTHS[month]} {year}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="py-2.5 px-5">Employee</th>
                <th className="py-2.5 pr-4">Days (P/H/A)</th>
                <th className="py-2.5 pr-4 text-right">Base</th>
                <th className="py-2.5 pr-4 text-right">+ Incentive</th>
                <th className="py-2.5 pr-4 text-right">+ Bonus</th>
                <th className="py-2.5 pr-4 text-right">- Deductions</th>
                <th className="py-2.5 pr-4 text-right">Net</th>
                <th className="py-2.5 px-5 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400">Loading…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400">No payroll for this month yet.</td></tr>
              ) : list.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 px-5 font-semibold text-slate-900">{p.employee_name}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-600 font-mono">{p.present_days} / {p.half_days} / {p.absent_days}</td>
                  <td className="py-2.5 pr-4 text-right">{fmtINR(p.base_salary)}</td>
                  <td className="py-2.5 pr-4 text-right text-green-600">{p.incentive ? fmtINR(p.incentive) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right text-green-600">{p.bonus ? fmtINR(p.bonus) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right text-red-500">{p.deductions ? fmtINR(p.deductions) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right font-bold text-[#4DA3FF]">{fmtINR(p.net_salary)}</td>
                  <td className="py-2.5 px-5 text-right">
                    <button onClick={() => download(p.id)} className="sk-btn-ghost py-1.5 text-xs" data-testid={`download-${p.id}`}>
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
