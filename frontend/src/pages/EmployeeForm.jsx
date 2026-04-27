import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  email: "", password: "", name: "", phone: "", role: "employee",
  employee_code: "", designation: "", department: "", joining_date: "",
  salary_type: "monthly", daily_rate: 0, monthly_salary: 0, working_days: 26,
  photo_url: "", address: "", bank_account: "", bank_name: "", bank_ifsc: "",
  status: "active",
};

export default function EmployeeForm() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew) {
      api.get(`/employees/${id}`).then(r => {
        const d = r.data;
        setData({ ...empty, ...d, password: "" });
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await api.post("/upload", { data_url: reader.result, folder: "employees" });
        setData(d => ({ ...d, photo_url: r.data.url }));
        toast.success("Photo uploaded");
      } catch { toast.error("Upload failed"); }
    };
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...data };
      // Coerce numbers
      payload.daily_rate = Number(payload.daily_rate || 0);
      payload.monthly_salary = Number(payload.monthly_salary || 0);
      payload.working_days = Number(payload.working_days || 26);
      if (!payload.joining_date) delete payload.joining_date;
      if (isNew) {
        await api.post("/employees", payload);
        toast.success("Employee created");
      } else {
        if (!payload.password) delete payload.password;
        await api.put(`/employees/${id}`, payload);
        toast.success("Employee updated");
      }
      nav("/employees");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="sk-page max-w-3xl">
      <Link to="/employees" className="text-sm text-slate-600 inline-flex items-center gap-1.5 mb-3"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="font-heading text-2xl md:text-3xl font-extrabold">{isNew ? "Add Employee" : "Edit Employee"}</h1>

      <form onSubmit={submit} className="mt-5 space-y-5" data-testid="employee-form">
        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Basic Info</div>
          <div className="flex items-start gap-4">
            {data.photo_url ? (
              <img src={data.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 grid place-items-center text-slate-400 text-xs">No photo</div>
            )}
            <label className="sk-btn-ghost cursor-pointer self-center">
              <Upload className="w-4 h-4" /> Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name *"><input required value={data.name} onChange={e => setData({ ...data, name: e.target.value })} className="sk-input" /></Field>
            <Field label="Email *"><input type="email" required disabled={!isNew} value={data.email} onChange={e => setData({ ...data, email: e.target.value })} className="sk-input disabled:bg-slate-50" /></Field>
            <Field label={isNew ? "Password *" : "New Password (leave blank to keep)"}>
              <input type="password" required={isNew} minLength={6} value={data.password} onChange={e => setData({ ...data, password: e.target.value })} className="sk-input" />
            </Field>
            <Field label="Phone"><input value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} className="sk-input" /></Field>
            <Field label="Role">
              <select disabled={!isAdmin} value={data.role} onChange={e => setData({ ...data, role: e.target.value })} className="sk-input">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={data.status} onChange={e => setData({ ...data, status: e.target.value })} className="sk-input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Job Info</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Employee Code"><input value={data.employee_code || ""} onChange={e => setData({ ...data, employee_code: e.target.value })} className="sk-input" /></Field>
            <Field label="Designation"><input value={data.designation || ""} onChange={e => setData({ ...data, designation: e.target.value })} className="sk-input" /></Field>
            <Field label="Department"><input value={data.department || ""} onChange={e => setData({ ...data, department: e.target.value })} className="sk-input" /></Field>
            <Field label="Joining Date"><input type="date" value={data.joining_date || ""} onChange={e => setData({ ...data, joining_date: e.target.value })} className="sk-input" /></Field>
          </div>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Salary</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Salary Type">
              <select value={data.salary_type} onChange={e => setData({ ...data, salary_type: e.target.value })} className="sk-input">
                <option value="monthly">Monthly</option>
                <option value="daily">Daily Wage</option>
              </select>
            </Field>
            <Field label={data.salary_type === "monthly" ? "Monthly Salary (₹)" : "Daily Rate (₹)"}>
              <input type="number" step="1" value={data.salary_type === "monthly" ? data.monthly_salary : data.daily_rate}
                onChange={e => setData({ ...data, [data.salary_type === "monthly" ? "monthly_salary" : "daily_rate"]: e.target.value })}
                className="sk-input" />
            </Field>
            <Field label="Working Days/month (for monthly)"><input type="number" value={data.working_days} onChange={e => setData({ ...data, working_days: e.target.value })} className="sk-input" /></Field>
          </div>
        </div>

        <div className="sk-card p-5 space-y-4">
          <div className="font-heading font-bold">Bank Details</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Account No."><input value={data.bank_account || ""} onChange={e => setData({ ...data, bank_account: e.target.value })} className="sk-input" /></Field>
            <Field label="Bank Name"><input value={data.bank_name || ""} onChange={e => setData({ ...data, bank_name: e.target.value })} className="sk-input" /></Field>
            <Field label="IFSC"><input value={data.bank_ifsc || ""} onChange={e => setData({ ...data, bank_ifsc: e.target.value })} className="sk-input" /></Field>
          </div>
          <Field label="Address"><textarea rows={2} value={data.address || ""} onChange={e => setData({ ...data, address: e.target.value })} className="sk-input" /></Field>
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/employees" className="sk-btn-ghost">Cancel</Link>
          <button disabled={busy} className="sk-btn-primary" data-testid="employee-form-submit">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {isNew ? "Create Employee" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label className="sk-label">{label}</label>
    {children}
  </div>
);
