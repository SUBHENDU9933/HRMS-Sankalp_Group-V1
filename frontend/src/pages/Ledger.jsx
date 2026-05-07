import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listLedger, ledgerBalance, createLedger, deleteLedger, listEmployees, liveSalary } from "@/lib/data";
import { fmtINR, fmtDate, todayISO, MONTHS } from "@/lib/utils-app";
import { BookOpen, Plus, Minus, Trash2, Loader2, TrendingUp, TrendingDown, Banknote, Wallet, FileText } from "lucide-react";
import { toast } from "sonner";

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
const PAYMENT_MODES = [
  { value: "cash",   label: "💵 Cash" },
  { value: "upi",    label: "📱 UPI" },
  { value: "bank",   label: "🏦 Bank transfer" },
  { value: "cheque", label: "📃 Cheque" },
];
const today = new Date();

export default function Ledger() {
  const { isAdmin, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState(isAdmin ? "" : user.id);
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState(false);

  // mode: "credit" | "debit" | "disbursement"
  const [mode, setMode] = useState("credit");

  // Form state per mode
  const [credForm, setCredForm] = useState({ employee_id: "", category: "bonus", amount: "", description: "", entry_date: todayISO() });
  const [debForm,  setDebForm]  = useState({ employee_id: "", category: "advance", amount: "", description: "", entry_date: todayISO() });
  const [disbForm, setDisbForm] = useState({
    employee_id: "", amount: "", description: "",
    entry_date: todayISO(),
    paid_for_month: today.getMonth() + 1,
    paid_for_year:  today.getFullYear(),
    payment_mode: "upi", transfer_ref: "",
    fully: false,
  });
  const [outstandingHint, setOutstandingHint] = useState(null);

  const load = async () => {
    const rows = await listLedger({ employee_id: empId || undefined });
    setItems(rows);
    setBalance(empId ? await ledgerBalance(empId) : null);
  };
  useEffect(() => { if (isAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [isAdmin]);
  useEffect(() => { load(); }, [empId]); // eslint-disable-line

  // When disbursement employee/period changes, fetch outstanding to assist "fully" amount
  useEffect(() => {
    if (mode !== "disbursement" || !disbForm.employee_id) { setOutstandingHint(null); return; }
    let cancelled = false;
    liveSalary(disbForm.employee_id, disbForm.paid_for_year, disbForm.paid_for_month)
      .then(s => { if (!cancelled) setOutstandingHint(s); })
      .catch(() => setOutstandingHint(null));
    return () => { cancelled = true; };
  }, [mode, disbForm.employee_id, disbForm.paid_for_year, disbForm.paid_for_month]);

  const submitCredit = async (e) => {
    e.preventDefault();
    if (!credForm.employee_id) { toast.error("Pick an employee"); return; }
    setBusy(true);
    try {
      const cat = CREDIT_CATEGORIES.find(c => c.value === credForm.category) || CREDIT_CATEGORIES[0];
      await createLedger({
        employee_id: credForm.employee_id,
        entry_type: cat.entry_type, category: cat.value,
        amount: Number(credForm.amount),
        description: credForm.description || cat.label,
        entry_date: credForm.entry_date,
      });
      toast.success("Credit added — live salary updated");
      setCredForm({ ...credForm, amount: "", description: "" });
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  const submitDebit = async (e) => {
    e.preventDefault();
    if (!debForm.employee_id) { toast.error("Pick an employee"); return; }
    setBusy(true);
    try {
      const cat = DEBIT_CATEGORIES.find(c => c.value === debForm.category) || DEBIT_CATEGORIES[0];
      await createLedger({
        employee_id: debForm.employee_id,
        entry_type: cat.entry_type, category: cat.value,
        amount: Number(debForm.amount),
        description: debForm.description || cat.label,
        entry_date: debForm.entry_date,
      });
      toast.success("Debit added — live salary updated");
      setDebForm({ ...debForm, amount: "", description: "" });
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  const submitDisb = async (e) => {
    e.preventDefault();
    if (!disbForm.employee_id) { toast.error("Pick an employee"); return; }
    setBusy(true);
    try {
      const desc = disbForm.description || `Salary payment for ${MONTHS[disbForm.paid_for_month]} ${disbForm.paid_for_year}${disbForm.transfer_ref ? ` · ref ${disbForm.transfer_ref}` : ""}`;
      await createLedger({
        employee_id: disbForm.employee_id,
        entry_type: "disbursement",
        category: disbForm.fully ? "fully_paid" : "partial_paid",
        amount: Number(disbForm.amount),
        description: desc,
        entry_date: disbForm.entry_date,
        payment_mode: disbForm.payment_mode,
        transfer_ref: disbForm.transfer_ref || null,
        paid_for_month: disbForm.paid_for_month,
        paid_for_year: disbForm.paid_for_year,
      });
      toast.success(`💸 Disbursed ${fmtINR(disbForm.amount)} for ${MONTHS[disbForm.paid_for_month]} ${disbForm.paid_for_year}`);
      setDisbForm({ ...disbForm, amount: "", description: "", transfer_ref: "" });
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  const useFullyAmount = () => {
    if (outstandingHint?.outstanding != null) {
      setDisbForm(d => ({ ...d, amount: Math.max(0, outstandingHint.outstanding).toFixed(2), fully: true }));
    }
  };

  const del = async (id) => { if (!window.confirm("Delete this entry?")) return; await deleteLedger(id); toast.success("Deleted"); load(); };

  return (
    <div className="sk-page space-y-5" data-testid="ledger-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>📒</span> Ledger / Khata</h1>
        <p className="text-sm text-slate-500 mt-1">Credit (bonus / incentive / allowance), debit (advance / deduction), and salary disbursement — all reflected in payslips.</p>
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
          <BalCard label="Disbursed" value={balance.disbursed} sign="✓" highlight />
        </div>
      )}

      {isAdmin && (
        <div className="sk-card overflow-hidden" data-testid="ledger-quick-form">
          {/* Mode toggle */}
          <div className="flex p-1.5 bg-slate-50 border-b border-slate-100 gap-1">
            <ModeBtn active={mode === "credit"} onClick={() => setMode("credit")} icon={<Plus className="w-4 h-4" />} label="Credit (+)" colorClass="bg-emerald-500" testid="ledger-mode-credit" />
            <ModeBtn active={mode === "debit"}  onClick={() => setMode("debit")}  icon={<Minus className="w-4 h-4" />} label="Debit (−)"  colorClass="bg-rose-500" testid="ledger-mode-debit" />
            <ModeBtn active={mode === "disbursement"} onClick={() => setMode("disbursement")} icon={<Banknote className="w-4 h-4" />} label="Salary Disbursement" colorClass="bg-[#4DA3FF]" testid="ledger-mode-disbursement" />
          </div>

          {mode === "credit" && (
            <form onSubmit={submitCredit} className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select required value={credForm.employee_id} onChange={e => setCredForm({ ...credForm, employee_id: e.target.value })} className="sk-input md:col-span-2">
                  <option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={credForm.category} onChange={e => setCredForm({ ...credForm, category: e.target.value })} className="sk-input">
                  {CREDIT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input required type="number" min="1" placeholder="Amount" value={credForm.amount} onChange={e => setCredForm({ ...credForm, amount: e.target.value })} className="sk-input" />
                <input type="date" value={credForm.entry_date} onChange={e => setCredForm({ ...credForm, entry_date: e.target.value })} className="sk-input" />
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input value={credForm.description} onChange={e => setCredForm({ ...credForm, description: e.target.value })} placeholder="Description (optional)" className="sk-input flex-1" />
                <button disabled={busy} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-white shadow active:scale-95 transition bg-emerald-500 hover:bg-emerald-600" data-testid="ledger-submit-button">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Add Credit
                </button>
              </div>
            </form>
          )}

          {mode === "debit" && (
            <form onSubmit={submitDebit} className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select required value={debForm.employee_id} onChange={e => setDebForm({ ...debForm, employee_id: e.target.value })} className="sk-input md:col-span-2">
                  <option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={debForm.category} onChange={e => setDebForm({ ...debForm, category: e.target.value })} className="sk-input">
                  {DEBIT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input required type="number" min="1" placeholder="Amount" value={debForm.amount} onChange={e => setDebForm({ ...debForm, amount: e.target.value })} className="sk-input" />
                <input type="date" value={debForm.entry_date} onChange={e => setDebForm({ ...debForm, entry_date: e.target.value })} className="sk-input" />
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input value={debForm.description} onChange={e => setDebForm({ ...debForm, description: e.target.value })} placeholder="Description (optional)" className="sk-input flex-1" />
                <button disabled={busy} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-white shadow active:scale-95 transition bg-rose-500 hover:bg-rose-600">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />} Add Debit
                </button>
              </div>
            </form>
          )}

          {mode === "disbursement" && (
            <form onSubmit={submitDisb} className="p-5 space-y-4" data-testid="disbursement-form">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select required value={disbForm.employee_id} onChange={e => setDisbForm({ ...disbForm, employee_id: e.target.value })} className="sk-input md:col-span-2">
                  <option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={disbForm.paid_for_month} onChange={e => setDisbForm({ ...disbForm, paid_for_month: Number(e.target.value) })} className="sk-input" data-testid="disb-month">
                  {MONTHS.slice(1).map((m, i) => <option key={i+1} value={i+1}>For {m}</option>)}
                </select>
                <select value={disbForm.paid_for_year} onChange={e => setDisbForm({ ...disbForm, paid_for_year: Number(e.target.value) })} className="sk-input" data-testid="disb-year">
                  {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Outstanding hint */}
              {outstandingHint && (
                <div className="rounded-xl border border-[#4DA3FF]/30 bg-[#4DA3FF]/5 p-3 text-xs flex flex-wrap items-center gap-3">
                  <span><b className="text-[#4DA3FF]">For {MONTHS[disbForm.paid_for_month]} {disbForm.paid_for_year}:</b></span>
                  <span>Earned: <b>{fmtINR(outstandingHint.net_live)}</b></span>
                  <span>Already paid: <b className="text-emerald-700">{fmtINR(outstandingHint.paid_amount || 0)}</b></span>
                  <span>Outstanding: <b className="text-[#F97316]">{fmtINR(outstandingHint.outstanding || 0)}</b></span>
                  <button type="button" onClick={useFullyAmount} className="ml-auto text-xs font-bold text-[#4DA3FF] hover:underline">Use outstanding (fully) →</button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <div className="sk-label">Amount *</div>
                  <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={disbForm.amount} onChange={e => setDisbForm({ ...disbForm, amount: e.target.value, fully: false })} className="sk-input" data-testid="disb-amount" />
                </div>
                <div>
                  <div className="sk-label">Payment mode *</div>
                  <select value={disbForm.payment_mode} onChange={e => setDisbForm({ ...disbForm, payment_mode: e.target.value })} className="sk-input" data-testid="disb-mode">
                    {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <div className="sk-label">Transfer ref / UTR / cheque no.</div>
                  <input value={disbForm.transfer_ref} onChange={e => setDisbForm({ ...disbForm, transfer_ref: e.target.value })} placeholder="e.g. UPI 4502318876 · UTR HDFC0001234" className="sk-input" data-testid="disb-ref" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="sk-label">Disbursed on</div>
                  <input type="date" value={disbForm.entry_date} onChange={e => setDisbForm({ ...disbForm, entry_date: e.target.value })} className="sk-input" />
                </div>
                <div className="md:col-span-2">
                  <div className="sk-label">Note (optional)</div>
                  <input value={disbForm.description} onChange={e => setDisbForm({ ...disbForm, description: e.target.value })} placeholder="Auto-fills if left blank" className="sk-input" />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button disabled={busy} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-white shadow active:scale-95 transition bg-[#4DA3FF] hover:bg-[#3B82F6]" data-testid="disb-submit-button">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} Record Disbursement
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4DA3FF]" /><div className="font-heading font-extrabold">All entries</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2.5 px-5">Date</th>
              {isAdmin && <th className="py-2.5 pr-4">Employee</th>}
              <th className="py-2.5 pr-4">Type</th>
              <th className="py-2.5 pr-4">Description / ref</th>
              <th className="py-2.5 pr-4 text-right">Amount</th>
              {isAdmin && <th className="py-2.5 px-5 text-right"></th>}
            </tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 6 : 4} className="py-8 text-center text-slate-400">No entries yet</td></tr>}
              {items.map(l => {
                const isCredit = l.entry_type === "allowance";
                const isDisb   = l.entry_type === "disbursement";
                const sign = isCredit ? "+" : isDisb ? "✓" : "−";
                const colour = isCredit ? "text-emerald-600" : isDisb ? "text-[#4DA3FF]" : "text-rose-600";
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/60 align-top">
                    <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap">{fmtDate(l.entry_date)}</td>
                    {isAdmin && <td className="py-2.5 pr-4 font-semibold text-slate-800">{l.employee_name}</td>}
                    <td className="py-2.5 pr-4">
                      <span className={`sk-badge ${isCredit ? "sk-badge-success" : isDisb ? "sk-badge-info" : l.entry_type === "advance" ? "sk-badge-warning" : "sk-badge-danger"}`}>
                        {sign} {l.category || l.entry_type}
                      </span>
                      {isDisb && l.paid_for_month && (
                        <div className="text-[10px] text-slate-500 mt-1">for {MONTHS[l.paid_for_month]} {l.paid_for_year}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {l.description || "—"}
                      {isDisb && (l.payment_mode || l.transfer_ref) && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {l.payment_mode && <span className="capitalize mr-2">{l.payment_mode}</span>}
                          {l.transfer_ref && <span className="font-mono">· {l.transfer_ref}</span>}
                        </div>
                      )}
                    </td>
                    <td className={`py-2.5 pr-4 text-right font-extrabold ${colour}`}>{sign}{fmtINR(l.amount)}</td>
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

const ModeBtn = ({ active, onClick, icon, label, colorClass, testid }) => (
  <button type="button" onClick={onClick}
    data-testid={testid}
    className={`flex-1 py-2.5 rounded-lg text-sm font-extrabold transition flex items-center justify-center gap-2 ${active ? `${colorClass} text-white shadow` : "text-slate-500 hover:bg-white"}`}>
    {icon} {label}
  </button>
);

const BalCard = ({ label, value, sign, highlight }) => (
  <div className={`rounded-xl p-4 border-2 ${highlight ? "bg-[#1E3A8A] border-[#1E3A8A] text-white" : sign === "+" ? "bg-[#DBEAFE] border-[#4DA3FF]/40 text-[#1E3A8A]" : "bg-[#FFE4D0] border-[#FFA94D]/50 text-[#C2410C]"}`}>
    <div className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? "text-[#FFE4D0]" : ""}`}>{label}</div>
    <div className={`font-heading text-xl md:text-2xl font-extrabold mt-1 ${highlight ? "text-white" : ""}`}>{sign === "✓" ? "" : sign}{fmtINR(value)}</div>
  </div>
);
