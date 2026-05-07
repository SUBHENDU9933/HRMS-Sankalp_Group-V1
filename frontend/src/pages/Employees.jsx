import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listEmployees, deleteEmployee } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Plus, Search, UserCircle, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

export default function Employees() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [statusF, setStatusF] = useState("active");
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); setItems(await listEmployees({ q, role, status: statusF })); setLoading(false); };
  useEffect(() => { load(); }, [role, statusF]);

  const del = async (id) => {
    if (!window.confirm("Delete this employee permanently?")) return;
    try { await deleteEmployee(id); toast.success("Deleted"); load(); }
    catch (e) { toast.error(e.message || "Failed"); }
  };

  return (
    <div className="sk-page space-y-5" data-testid="employees-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">Manage team members, roles, and bank details</p>
        </div>
        {isAdmin && <Link to="/employees/new" className="sk-btn-primary" data-testid="add-employee-button"><Plus className="w-4 h-4" /> Add Employee</Link>}
      </div>
      <div className="sk-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search name / email / code" className="sk-input pl-9" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="sk-input w-auto">
          <option value="">All Roles</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option>
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="sk-input w-auto">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="">All</option>
        </select>
      </div>
      {loading ? <div className="text-slate-500">Loading…</div> : items.length === 0 ? (
        <div className="sk-card p-10 text-center"><UserCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" /><div className="font-semibold">No employees</div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(e => (
            <div key={e.id} className="sk-card p-4" data-testid={`employee-card-${e.id}`}>
              <div className="flex items-start gap-3">
                {e.photo_url ? <img src={e.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl bg-[#1E3A8A] grid place-items-center text-white font-bold border-2 border-[#F97316]">{e.name?.[0]?.toUpperCase() || "?"}</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-bold truncate">{e.name}</div>
                  <div className="text-xs text-slate-500 truncate">{e.designation || e.role}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className={`sk-badge ${e.role === "admin" ? "sk-badge-info" : e.role === "manager" ? "sk-badge-warning" : "sk-badge-neutral"}`}>{e.role}</span>
                    {e.status !== "active" && <span className="sk-badge sk-badge-danger">{e.status}</span>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 truncate">{e.email}</div>
              <div className="text-xs text-slate-500 mt-1">{e.phone || "—"}</div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">{e.salary_type === "monthly" ? `₹${e.monthly_salary || 0}/mo` : `₹${e.daily_rate || 0}/day`}</div>
                <div className="flex gap-1">
                  <Link to={`/employees/${e.id}`} className="p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-[#4DA3FF]"><Edit3 className="w-4 h-4" /></Link>
                  {isAdmin && <button onClick={() => del(e.id)} className="p-1.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
