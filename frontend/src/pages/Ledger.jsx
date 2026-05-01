import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listLedger, ledgerBalance, createLedger, deleteLedger, listEmployees } from "@/lib/data";
import { fmtINR, fmtDate, todayISO } from "@/lib/utils-app";
import { BookOpen, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Ledger() {
  const { isAdmin, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState(isAdmin ? "" : user.id);
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employee_id: "", entry_type: "advance", amount: "", description: "", entry_date: todayISO() });

  const load = async () => {
    const rows = await listLedger({ employee_id: empId || undefined });
    setItems(rows);
    setBalance(empId ? await ledgerBalance(empId) : null);
  };
  useEffect(() => { if (isAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [isAdmin]);
  useEffect(() => { load(); }, [empId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await createLedger({ ...form, amount: Number(form.amount) }); toast.success("Entry added"); setForm({ ...form, amount: "", description: "" }); load(); }
    catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Delete this entry?")) return; await deleteLedger(id); toast.success("Deleted"); load(); };

  return (
    <div className="sk-page space-y-5" data-testid="ledger-page">
      <div><h1 className="font-heading text-2xl md:text-3xl font-extrabold">Ledger / Khata</h1>
        <p className="text-sm text-slate-500 mt-1">Advances, allowances and deductions per employee</p></div>
      {isAdmin && (
        <div className="sk-card p-3 flex flex-wrap items-center gap-2">
          <select value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input w-auto md:w-72">
            <option value="">All Employees</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BalCard label="Advance" value={balance.advance} color="text-amber-700 bg-amber-50" />
          <BalCard label="Allowance" value={balance.allowance} color="text-green-700 bg-green-50" />
          <BalCard label="Deduction" value={balance.deduction} color="text-red-700 bg-red-50" />
          <BalCard label="Outstanding" value={balance.balance} color="text-[#4DA3FF] bg-blue-50" highlight />
        </div>
      )}
      {isAdmin && (
        <form onSubmit={submit} className="sk-card p-5">
          <div className="flex items-center gap-2 mb-3"><Plus className="w-4 h-4 text-[#4DA3FF]" /><div className="font-heading font-bold">Add Entry</div></div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="sk-input md:col-span-2">
              <option value="">Select employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select value={form.entry_type} onChange={e => setForm({ ...form, entry_type: e.target.value })} className="sk-input">
              <option value="advance">Advance</option><option value="allowance">Allowance</option><option value="deduction">Deduction</option>
            </select>
            <input required type="number" step="1" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="sk-input" />
            <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} className="sk-input" />
          </div>
          <div className="mt-3 flex gap-2">
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="sk-input flex-1" />
            <button disabled={busy} className="sk-btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
          </div>
        </form>
      )}
      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#4DA3FF]" /><div className="font-heading font-bold">Entries</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2.5 px-5">Date</th>{isAdmin && <th className="py-2.5 pr-4">Employee</th>}
              <th className="py-2.5 pr-4">Type</th><th className="py-2.5 pr-4 text-right">Amount</th>
              <th className="py-2.5 pr-4">Description</th>{isAdmin && <th className="py-2.5 px-5 text-right"></th>}
            </tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 6 : 4} className="py-6 text-center text-slate-400">No entries</td></tr>}
              {items.map(l => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2.5 px-5">{fmtDate(l.entry_date)}</td>
                  {isAdmin && <td className="py-2.5 pr-4 font-medium">{l.employee_name}</td>}
                  <td className="py-2.5 pr-4"><span className={`sk-badge ${l.entry_type === "advance" ? "sk-badge-warning" : l.entry_type === "allowance" ? "sk-badge-success" : "sk-badge-danger"}`}>{l.entry_type}</span></td>
                  <td className="py-2.5 pr-4 text-right font-bold">{fmtINR(l.amount)}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{l.description || "—"}</td>
                  {isAdmin && <td className="py-2.5 px-5 text-right"><button onClick={() => del(l.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const BalCard = ({ label, value, color, highlight }) => (
  <div className={`rounded-xl p-4 ${color} ${highlight ? "ring-2 ring-[#4DA3FF]/20" : ""}`}>
    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</div>
    <div className="font-heading text-2xl font-extrabold mt-1">{fmtINR(value)}</div>
  </div>
);
