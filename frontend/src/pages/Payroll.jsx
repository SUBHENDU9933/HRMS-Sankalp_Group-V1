import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  listPayroll, generatePayroll, updatePayroll, deletePayroll,
  listEmployees, getEmployee, getCompanySettings, liveSalary, listDisbursements,
} from "@/lib/data";
import { generatePayslipPdf } from "@/lib/pdf";
import { fmtINR, MONTHS, fmtDateTime } from "@/lib/utils-app";
import MonthYearPicker from "@/components/MonthYearPicker";
import {
  Wallet, Download, Sparkles, Loader2, Trash2, Pencil, Check, X, Save, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const today = new Date();

export default function Payroll() {
  const { isAdmin, user } = useAuth();
  const [period, setPeriod] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [list, setList] = useState([]);
  const [paidMap, setPaidMap] = useState({}); // employee_id -> total paid for this period
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null); // id being edited
  const [editData, setEditData] = useState({});

  const load = async () => {
    setLoading(true);
    const rows = await listPayroll({ month: period.month, year: period.year, employee_id: isAdmin ? undefined : user.id });
    setList(rows);
    // Fetch disbursements for this period
    const disbs = await listDisbursements({ paid_for_year: period.year, paid_for_month: period.month, employee_id: isAdmin ? undefined : user.id });
    const paidByEmp = {};
    disbs.forEach(d => { paidByEmp[d.employee_id] = (paidByEmp[d.employee_id] || 0) + Number(d.amount || 0); });
    setPaidMap(paidByEmp);
    setLoading(false);
  };
  useEffect(() => { load(); }, [period.month, period.year, isAdmin, user.id]); // eslint-disable-line
  useEffect(() => { if (isAdmin) listEmployees({ status: "active" }).then(setEmployees); }, [isAdmin]);

  const isRunningMonth = period.year === today.getFullYear() && period.month === today.getMonth() + 1;

  const download = async (p) => {
    try {
      const [emp, co, disbs] = await Promise.all([
        getEmployee(p.employee_id),
        getCompanySettings().catch(() => null),
        listDisbursements({ employee_id: p.employee_id, paid_for_year: p.year, paid_for_month: p.month }).catch(() => []),
      ]);
      await generatePayslipPdf(p, emp, co, disbs);
    } catch (e) { toast.error("Download failed: " + e.message); }
  };

  const startEdit = (p) => {
    setEditRow(p.id);
    setEditData({
      incentive: p.incentive || 0,
      bonus: p.bonus || 0,
      overtime: p.overtime || 0,
      deductions: p.deductions || 0,
      base_salary: p.base_salary || 0,
    });
  };
  const saveEdit = async (id) => {
    try {
      const patch = {
        incentive: Number(editData.incentive || 0),
        bonus: Number(editData.bonus || 0),
        overtime: Number(editData.overtime || 0),
        deductions: Number(editData.deductions || 0),
        base_salary: Number(editData.base_salary || 0),
      };
      await updatePayroll(id, patch);
      toast.success("Payroll updated");
      setEditRow(null);
      load();
    } catch (e) { toast.error(e.message || "Failed"); }
  };
  const del = async (p) => {
    if (!window.confirm(`Delete payslip for ${p.employee_name} — ${MONTHS[p.month]} ${p.year}?`)) return;
    try { await deletePayroll(p.id); toast.success("Deleted"); load(); }
    catch (e) { toast.error(e.message || "Failed"); }
  };

  return (
    <div className="sk-page space-y-5" data-testid="payroll-page">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold flex items-center gap-2"><span>💼</span> Payroll</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isRunningMonth ? "Running month — calculated till today" : "Full-month closed payroll"} · auto-filled from attendance + ledger
          </p>
        </div>
        <MonthYearPicker value={period} onChange={setPeriod} />
      </div>

      {/* Generator */}
      {isAdmin ? (
        <AdminGenerator employees={employees} period={period} onGenerated={load} />
      ) : (
        <EmployeeGenerator userId={user.id} userName={user.name} period={period} onGenerated={load} isRunningMonth={isRunningMonth} />
      )}

      {/* Payslip list */}
      <div className="sk-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#4DA3FF]" />
          <div className="font-heading font-extrabold">📄 {MONTHS[period.month]} {period.year} — generated payslips</div>
          {isRunningMonth && <span className="sk-badge sk-badge-warning">till today</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="py-2.5 px-5">Employee</th>
              <th className="py-2.5 pr-4">Days P/H/A</th>
              <th className="py-2.5 pr-4 text-right">Base</th>
              <th className="py-2.5 pr-4 text-right">+ Inc.</th>
              <th className="py-2.5 pr-4 text-right">+ Bonus</th>
              <th className="py-2.5 pr-4 text-right">+ OT</th>
              <th className="py-2.5 pr-4 text-right">− Ded.</th>
              <th className="py-2.5 pr-4 text-right">Net</th>
              <th className="py-2.5 pr-4 text-right">Paid</th>
              <th className="py-2.5 pr-4 text-right">Outstanding</th>
              <th className="py-2.5 pr-4">Status</th>
              <th className="py-2.5 pr-4">Generated</th>
              <th className="py-2.5 px-5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={13} className="py-8 text-center text-slate-400">Loading…</td></tr>
                : list.length === 0 ? <tr><td colSpan={13} className="py-8 text-center text-slate-400">No payslip for {MONTHS[period.month]} {period.year} yet. Generate one above.</td></tr>
                : list.map(p => {
                  const isEd = editRow === p.id;
                  const paid = paidMap[p.employee_id] || 0;
                  const out  = (p.net_salary || 0) - paid;
                  const status = paid <= 0 ? "unpaid" : (out > 0.01 ? "partial" : "paid");
                  const nm = (k) => <input type="number" step="1" value={editData[k] || 0} onChange={e => setEditData(d => ({ ...d, [k]: e.target.value }))} className="sk-input !py-1 !px-2 w-24 text-right" />;
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 align-middle">
                      <td className="py-2.5 px-5 font-semibold text-slate-900">{p.employee_name}</td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600 font-mono">{p.present_days} / {p.half_days} / {p.absent_days}</td>
                      <td className="py-2.5 pr-4 text-right">{isEd ? nm("base_salary") : fmtINR(p.base_salary)}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-600">{isEd ? nm("incentive") : (p.incentive ? fmtINR(p.incentive) : "—")}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-600">{isEd ? nm("bonus") : (p.bonus ? fmtINR(p.bonus) : "—")}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-600">{isEd ? nm("overtime") : (p.overtime ? fmtINR(p.overtime) : "—")}</td>
                      <td className="py-2.5 pr-4 text-right text-rose-500">{isEd ? nm("deductions") : (p.deductions ? fmtINR(p.deductions) : "—")}</td>
                      <td className="py-2.5 pr-4 text-right font-extrabold text-[#F97316]">{fmtINR(p.net_salary)}</td>
                      <td className="py-2.5 pr-4 text-right text-[#4DA3FF] font-bold">{paid > 0 ? fmtINR(paid) : "—"}</td>
                      <td className={`py-2.5 pr-4 text-right font-extrabold ${out > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtINR(Math.max(0, out))}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`sk-badge ${status === "paid" ? "sk-badge-success" : status === "partial" ? "sk-badge-warning" : "sk-badge-danger"}`}>
                          {status === "paid" ? "✅ Paid" : status === "partial" ? "🟡 Partial" : "🔴 Unpaid"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500">{p.generated_at ? fmtDateTime(p.generated_at) : "—"}</td>
                      <td className="py-2.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {isEd ? (
                            <>
                              <button onClick={() => saveEdit(p.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Save"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditRow(null)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => download(p)} className="sk-btn-ghost !py-1 !px-2 text-xs" data-testid="download-payslip-button"><Download className="w-3.5 h-3.5" /> PDF</button>
                              {isAdmin && <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>}
                              {isAdmin && <button onClick={() => del(p)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                            </>
                          )}
                        </div>
                      </td>
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

/* ---------------- Admin payroll generator with auto-fill preview ---------------- */
function AdminGenerator({ employees, period, onGenerated }) {
  const [empId, setEmpId] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ incentive: 0, bonus: 0, overtime: 0, extra_deductions: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!empId) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    liveSalary(empId, period.year, period.month)
      .then(s => { if (!cancelled) setPreview(s); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [empId, period.year, period.month]);

  const submit = async (e) => {
    e.preventDefault();
    if (!empId) { toast.error("Select employee"); return; }
    setBusy(true);
    try {
      await generatePayroll({
        employee_id: empId, month: period.month, year: period.year,
        incentive: Number(form.incentive || 0),
        bonus: Number(form.bonus || 0),
        overtime: Number(form.overtime || 0),
        extra_deductions: Number(form.extra_deductions || 0),
        notes: form.notes || null,
      });
      toast.success(`Payslip saved for ${MONTHS[period.month]} ${period.year}`);
      setForm({ incentive: 0, bonus: 0, overtime: 0, extra_deductions: 0, notes: "" });
      setEmpId("");
      onGenerated();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const projectedNet = preview
    ? (preview.base_salary + Number(form.incentive || 0) + Number(form.bonus || 0) + Number(form.overtime || 0) - (preview.advance + preview.deductions + Number(form.extra_deductions || 0)))
    : null;

  return (
    <form onSubmit={submit} className="sk-card p-5 space-y-4" data-testid="admin-generate-form">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#FFA94D]" />
        <div className="font-heading font-extrabold">Generate / update payslip for {MONTHS[period.month]} {period.year}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select required value={empId} onChange={e => setEmpId(e.target.value)} className="sk-input">
          <option value="">Select employee…</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="sk-input" />
      </div>

      {preview && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
          <div className="font-bold text-emerald-800 mb-1">Auto-filled from attendance + ledger</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 font-mono">
            <span>P/H/A: <b>{preview.present_days}/{preview.half_days}/{preview.absent_days}</b></span>
            <span>Base: <b>{fmtINR(preview.base_salary)}</b></span>
            <span>Allowance: <b className="text-emerald-700">+{fmtINR(preview.allowance)}</b></span>
            <span>Advance: <b className="text-rose-700">−{fmtINR(preview.advance)}</b></span>
            <span>Deduction: <b className="text-rose-700">−{fmtINR(preview.deductions)}</b></span>
          </div>
        </div>
      )}
      {previewLoading && <div className="text-xs text-slate-400">Calculating auto-fill…</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <NumField label="+ Incentive" value={form.incentive} onChange={v => setForm({ ...form, incentive: v })} />
        <NumField label="+ Bonus"      value={form.bonus}      onChange={v => setForm({ ...form, bonus: v })} />
        <NumField label="+ Overtime"   value={form.overtime}   onChange={v => setForm({ ...form, overtime: v })} />
        <NumField label="− Extra deduction" value={form.extra_deductions} onChange={v => setForm({ ...form, extra_deductions: v })} negative />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          {projectedNet != null && <>Projected net: <b className="text-[#F97316] text-base">{fmtINR(projectedNet)}</b></>}
        </div>
        <button disabled={busy || !empId} className="sk-btn-primary" data-testid="generate-payroll-button">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Generate / update payslip
        </button>
      </div>
    </form>
  );
}

/* ---------------- Employee self-generate ---------------- */
function EmployeeGenerator({ userId, userName, period, onGenerated, isRunningMonth }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    liveSalary(userId, period.year, period.month).then(s => { if (!cancelled) setPreview(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, period.year, period.month]);

  const generate = async () => {
    setBusy(true);
    try {
      await generatePayroll({ employee_id: userId, month: period.month, year: period.year });
      toast.success("Your payslip is ready");
      onGenerated();
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="sk-card p-5 space-y-3" data-testid="employee-generate-panel">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#FFA94D]" />
        <div className="font-heading font-extrabold">🧾 Your payslip — {MONTHS[period.month]} {period.year}</div>
        {isRunningMonth && <span className="sk-badge sk-badge-warning">running month — till today</span>}
      </div>
      {preview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono rounded-xl border border-slate-100 bg-slate-50 p-3">
          <span>P/H/A: <b>{preview.present_days}/{preview.half_days}/{preview.absent_days}</b></span>
          <span>Base: <b>{fmtINR(preview.base_salary)}</b></span>
          <span>Allowance: <b className="text-emerald-700">+{fmtINR(preview.allowance)}</b></span>
          <span>Advance: <b className="text-rose-700">−{fmtINR(preview.advance)}</b></span>
          <span className="col-span-2 md:col-span-1">Net: <b className="text-[#F97316] text-base">{fmtINR(preview.net_live)}</b></span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Click to save this payslip to your records and download the branded PDF.</div>
        <button onClick={generate} disabled={busy || !preview} className="sk-btn-primary" data-testid="employee-self-generate-button">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Generate my payslip
        </button>
      </div>
    </div>
  );
}

const NumField = ({ label, value, onChange, negative }) => (
  <div>
    <div className={`text-[10px] font-bold uppercase tracking-wider ${negative ? "text-rose-700" : "text-emerald-700"}`}>{label}</div>
    <input type="number" step="1" value={value} onChange={e => onChange(e.target.value)} className="sk-input mt-1" placeholder="0" />
  </div>
);
