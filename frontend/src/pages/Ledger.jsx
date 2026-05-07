import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listLedger, ledgerBalance, createLedger, deleteLedger, listEmployees } from "@/lib/data";
import { fmtINR, fmtDate, todayISO } from "@/lib/utils-app";
import { BookOpen, Plus, Minus, Trash2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

/** Categories, mapped onto entry_type for math correctness. */
const CREDIT_CATEGORIES = [
  { value: "bonus",       label: "🎁 Bonus",            entry_type: "allowance" },
  { value: "incentive",   label: "🚀 Incentive",        entry_type: "allowance" },
  { value: "extra_day",   label: "🗓️ Extra-day Allowance", entry_type: "allowance" },
  { value: "allowance",   label: "🪙 General Allowance", entry_type: "allowance" },
];
const DEBIT_CATEGORIES = [
  { value: "advance",     label: "💵 Advance",     entry_type: "advance" },
  { value: "deduction",   label: "📉 Deduction",   entry_type: "deduction" },
];

export default function Ledger() {
  const { isAdmin, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState(isAdmin ? "" : user.id);
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState(false);

  // mode: "credit" (+) or "debit" (-)
  const [mode, setMode] = useState("credit");
  const cats = mode === "credit" ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;
  const [form, setForm] = useState({ employee_id: "", category: "bonus", amount: "", description: "", entry_date: todayISO() });

  // Reset category when mode changes
  useEffect(() => { setForm(f => ({ ...f, category: cats[0].value })); }, [mode]); // eslint-disable-line

  const load = async () => {
    const rows = await listLedger({ employee_id: empId || undefined });
    setItems(rows);
    setBalance(empId ? await ledgerBalance(empId) : null);
  };
  useEffect(() => { if (isAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [isAdmin]);
  useEffect(() => { load(); }, [empId]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) { toast.error("Pick an employee"); return; }
    setBusy(true);
    try {
      const cat = cats.find(c => c.value === form.category) || cats[0];
      await createLedger({
        employee_id: form.employee_id,
        entry_type: cat.entry_type,
        category: cat.value,
        amount: Number(form.amount),
        description: form.description || cat.label,
        entry_date: form.entry_date,
      });
      toast.success(`${mode === "credit" ? "Credit" : "Debit"} added — live salary updated`);
      setForm({ ...form, amount: "", description: "" });
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Delete this entry?")) return; await deleteLedger(id); toast.success("Deleted"); load(); };

  return (
    <div className="sk-page space-y-5" data-testid="ledger-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>📒</span> Ledger / Khata</h1>
        <p className="text-sm text-slate-500 mt-1">Credit (bonus, incentive, allowance) and debit (advance, deduction) — instantly reflected in live salary.</p>
      </div>

      {isAdmin && (
        <div className="sk-card p-3 flex flex-wrap items-center gap-2">
          <select value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input w-auto md:w-72">
            <option value="">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BalCard label="Allowance" value={balance.allowance} sign="+" />
          <BalCard label="Advance" value={balance.advance} sign="−" />
          <BalCard label="Deduction" value={balance.deduction} sign="−" />
          <BalCard label="Outstanding" value={balance.balance} sign={balance.balance >= 0 ? "−" : "+"} highlight />
        </div>
      )}

      {isAdmin && (
        <form onSubmit={submit} className="sk-card overflow-hidden" data-testid="ledger-quick-form">
          {/* Mode toggle */}
          <div className="flex p-1.5 bg-slate-50 border-b border-slate-100">
            <button type="button" onClick={() => setMode("credit")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-extrabold transition flex items-center justify-center gap-2 ${mode === "credit" ? "bg-emerald-500 text-white shadow" : "text-slate-500 hover:bg-white"}`}
              data-testid="ledger-mode-credit">
              <Plus className="w-4 h-4" /> Credit (+)
            </button>
            <button type="button" onClick={() => setMode("debit")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-extrabold transition flex items-center justify-center gap-2 ${mode === "debit" ? "bg-rose-500 text-white shadow" : "text-slate-500 hover:bg-white"}`}
              data-testid="ledger-mode-debit">
              <Minus className="w-4 h-4" /> Debit (−)
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="sk-input md:col-span-2">
              <option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="sk-input">
              {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input required type="number" step="1" min="1" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="sk-input" />
            <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} className="sk-input" />
          </div>
          <div className="px-5 pb-5 flex flex-col md:flex-row gap-3">
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="sk-input flex-1" />
            <button disabled={busy} className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-white shadow active:scale-95 transition ${mode === "credit" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"}`} data-testid="ledger-submit-button">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (mode === "credit" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
              {mode === "credit" ? "Add Credit" : "Add Debit"}
            </button>
          </div>
        </form>
      )}

      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4DA3FF]" /><div className="font-heading font-extrabold">All entries</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2.5 px-5">Date</th>{isAdmin && <th className="py-2.5 pr-4">Employee</th>}
              <th className="py-2.5 pr-4">Type</th><th className="py-2.5 pr-4">Description</th>
              <th className="py-2.5 pr-4 text-right">Amount</th>
              {isAdmin && <th className="py-2.5 px-5 text-right"></th>}
            </tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 6 : 4} className="py-8 text-center text-slate-400">No entries yet</td></tr>}
              {items.map(l => {
                const isCredit = l.entry_type === "allowance";
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="py-2.5 px-5 text-slate-600">{fmtDate(l.entry_date)}</td>
                    {isAdmin && <td className="py-2.5 pr-4 font-semibold text-slate-800">{l.employee_name}</td>}
                    <td className="py-2.5 pr-4">
                      <span className={`sk-badge ${isCredit ? "sk-badge-success" : l.entry_type === "advance" ? "sk-badge-warning" : "sk-badge-danger"}`}>
                        {isCredit ? "+" : "−"} {l.category || l.entry_type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{l.description || "—"}</td>
                    <td className={`py-2.5 pr-4 text-right font-extrabold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                      {isCredit ? "+" : "−"}{fmtINR(l.amount)}
                    </td>
                    {isAdmin && <td className="py-2.5 px-5 text-right"><button onClick={() => del(l.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const BalCard = ({ label, value, sign, highlight }) => (
  <div className={`rounded-xl p-4 border ${highlight ? "bg-gradient-to-br from-[#4DA3FF]/10 to-[#FFA94D]/10 border-[#4DA3FF]/30" : sign === "+" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
    <div className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? "text-[#4DA3FF]" : sign === "+" ? "text-emerald-700" : "text-rose-700"}`}>{label}</div>
    <div className="font-heading text-xl md:text-2xl font-extrabold mt-1 text-slate-900">{sign}{fmtINR(value)}</div>
  </div>
);
