import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtINR, fmtDate, todayISO } from "@/lib/utils-app";
import { Receipt, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const CATEGORIES = ["Office", "Travel", "Materials", "Marketing", "Utilities", "Salary", "Misc"];

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "Office",
    amount: "",
    description: "",
    expense_date: todayISO(),
    paid_by: "",
  });

  const load = async () => {
    const params = {};
    if (category) params.category = category;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const r = await api.get("/expenses", { params });
    setItems(r.data);
  };

  useEffect(() => { load(); }, [category, dateFrom, dateTo]);

  const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount) });
      toast.success("Expense added");
      setForm({ ...form, amount: "", description: "", paid_by: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="sk-page space-y-5" data-testid="expenses-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track operational expenses with category & date filters</p>
        </div>
        <div className="sk-card px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">Filtered Total</div>
          <div className="font-heading text-2xl font-extrabold text-[#FFA94D]">{fmtINR(total)}</div>
        </div>
      </div>

      <form onSubmit={submit} className="sk-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-[#4DA3FF]" />
          <div className="font-heading font-bold">Add Expense</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="sk-input">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required type="number" step="1" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="sk-input" data-testid="expense-amount" />
          <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} className="sk-input" />
          <input placeholder="Paid by" value={form.paid_by} onChange={e => setForm({ ...form, paid_by: e.target.value })} className="sk-input" />
          <button disabled={busy} className="sk-btn-primary" data-testid="add-expense-button">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="sk-input mt-3" />
      </form>

      <div className="sk-card p-3 flex flex-wrap items-center gap-2">
        <select value={category} onChange={e => setCategory(e.target.value)} className="sk-input w-auto">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sk-input w-auto" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sk-input w-auto" />
      </div>

      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#4DA3FF]" />
          <div className="font-heading font-bold">All Expenses</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="py-2.5 px-5">Date</th>
                <th className="py-2.5 pr-4">Category</th>
                <th className="py-2.5 pr-4 text-right">Amount</th>
                <th className="py-2.5 pr-4">Paid by</th>
                <th className="py-2.5 pr-4">Description</th>
                {isAdmin && <th className="py-2.5 px-5 text-right"></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="py-6 text-center text-slate-400">No expenses</td></tr>}
              {items.map(e => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2.5 px-5">{fmtDate(e.expense_date)}</td>
                  <td className="py-2.5 pr-4"><span className="sk-badge sk-badge-info">{e.category}</span></td>
                  <td className="py-2.5 pr-4 text-right font-bold">{fmtINR(e.amount)}</td>
                  <td className="py-2.5 pr-4">{e.paid_by || "—"}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{e.description || "—"}</td>
                  {isAdmin && (
                    <td className="py-2.5 px-5 text-right">
                      <button onClick={() => del(e.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
