/**
 * Data access layer — thin wrappers around supabase.
 * Every screen uses these; RLS enforces security.
 */
import { supabase, uploadDataUrl, uploadFile, signUpIsolated } from "./supabase";
export { uploadDataUrl, uploadFile };

const thr = (r) => { if (r.error) throw r.error; return r.data; };

/* ---------------- employees ---------------- */
export async function listEmployees({ q = "", role = "", status = "" } = {}) {
  let query = supabase.from("employees").select("*").order("created_at", { ascending: false });
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,employee_code.ilike.%${q}%`);
  return thr(await query);
}
export async function getEmployee(id) {
  return thr(await supabase.from("employees").select("*").eq("id", id).single());
}
/** Create employee — creates auth user (in isolated client) then create_employee_row RPC */
export async function createEmployee({ email, password, ...fields }) {
  // 1. Create auth user using an ISOLATED client so the admin's session is NOT rotated.
  const { error: signErr } = await signUpIsolated({
    email, password, name: fields.name,
  });
  if (signErr && !/already\s+registered|already\s+been\s+registered|user_already_exists|exists/i.test(signErr.message || "")) {
    // Friendlier messages
    const m = (signErr.message || "").toLowerCase();
    const status = signErr.status || signErr.code;
    if (status === 429 || m.includes("rate") || m.includes("too many")) {
      throw new Error("Too many signups in a short time. Wait 5–10 minutes and try again. (Supabase free-tier rate limit)");
    }
    if (m.includes("password") && m.includes("6")) {
      throw new Error("Password must be at least 6 characters.");
    }
    throw new Error(signErr.message || "Failed to create auth user");
  }

  // 2. Create employees row via SECURITY DEFINER RPC (admin-only)
  const rpcArgs = {
    p_email: email.toLowerCase(),
    p_name: fields.name,
    p_phone: fields.phone || null,
    p_role: fields.role || "employee",
    p_employee_code: fields.employee_code || null,
    p_designation: fields.designation || null,
    p_department: fields.department || null,
    p_joining_date: fields.joining_date || null,
    p_salary_type: fields.salary_type || "monthly",
    p_daily_rate: Number(fields.daily_rate || 0),
    p_monthly_salary: Number(fields.monthly_salary || 0),
    p_working_days: Number(fields.working_days || 26),
    p_photo_url: fields.photo_url || null,
    p_address: fields.address || null,
    p_bank_account: fields.bank_account || null,
    p_bank_name: fields.bank_name || null,
    p_bank_ifsc: fields.bank_ifsc || null,
  };
  return thr(await supabase.rpc("create_employee_row", rpcArgs));
}
export async function updateEmployee(id, patch) {
  const { password, email, ...rest } = patch;
  const data = thr(await supabase.from("employees").update(rest).eq("id", id).select().single());
  if (password) await supabase.auth.updateUser({ password });
  return data;
}
export async function deleteEmployee(id) {
  return thr(await supabase.from("employees").delete().eq("id", id));
}

/* ---------------- attendance ---------------- */
export async function listAttendance({ employee_id, date_from, date_to, status } = {}) {
  let q = supabase.from("attendance").select("*, employee:employees(name)")
    .order("date", { ascending: false }).order("created_at", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (date_from) q = q.gte("date", date_from);
  if (date_to) q = q.lte("date", date_to);
  if (status) q = q.eq("status", status);
  const rows = thr(await q);
  return rows.map(r => ({ ...r, employee_name: r.employee?.name }));
}
export async function upsertAttendance({ employee_id, date, status, selfie_url, latitude, longitude, location_address, notes }) {
  const payload = { employee_id, date, status, selfie_url, latitude, longitude, location_address, notes, check_in_time: new Date().toISOString() };
  return thr(await supabase.from("attendance").upsert(payload, { onConflict: "employee_id,date" }).select().single());
}
export async function updateAttendance(id, patch) {
  return thr(await supabase.from("attendance").update(patch).eq("id", id).select().single());
}
export async function deleteAttendance(id) {
  return thr(await supabase.from("attendance").delete().eq("id", id));
}

/* ---------------- visits ---------------- */
export async function listVisits({ employee_id, visit_type, status, date_from, date_to } = {}) {
  let q = supabase.from("visits").select("*, employee:employees(name)").order("visit_date", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (visit_type) q = q.eq("visit_type", visit_type);
  if (status) q = q.eq("status", status);
  if (date_from) q = q.gte("visit_date", date_from);
  if (date_to) q = q.lte("visit_date", date_to);
  const rows = thr(await q);
  return rows.map(r => ({ ...r, employee_name: r.employee?.name }));
}
export async function getVisit(id) {
  const r = thr(await supabase.from("visits").select("*, employee:employees(name)").eq("id", id).single());
  return { ...r, employee_name: r.employee?.name };
}
export async function createVisit(payload) {
  return thr(await supabase.from("visits").insert(payload).select().single());
}
export async function updateVisit(id, patch) {
  return thr(await supabase.from("visits").update(patch).eq("id", id).select().single());
}
export async function deleteVisit(id) {
  return thr(await supabase.from("visits").delete().eq("id", id));
}

/* ---------------- payroll ---------------- */
export async function listPayroll({ month, year, employee_id } = {}) {
  let q = supabase.from("payroll").select("*, employee:employees(name)")
    .order("year", { ascending: false }).order("month", { ascending: false });
  if (month) q = q.eq("month", month);
  if (year) q = q.eq("year", year);
  if (employee_id) q = q.eq("employee_id", employee_id);
  const rows = thr(await q);
  return rows.map(r => ({ ...r, employee_name: r.employee?.name }));
}
export async function generatePayroll(args) {
  return thr(await supabase.rpc("generate_payroll", {
    p_employee_id: args.employee_id,
    p_month: Number(args.month),
    p_year: Number(args.year),
    p_incentive: Number(args.incentive || 0),
    p_bonus: Number(args.bonus || 0),
    p_overtime: Number(args.overtime || 0),
    p_extra_deductions: Number(args.extra_deductions || 0),
    p_notes: args.notes || null,
  }));
}
export async function updatePayroll(id, patch) {
  // Recompute net
  const cur = thr(await supabase.from("payroll").select("*").eq("id", id).single());
  const merged = { ...cur, ...patch };
  const net = (merged.base_salary || 0) + (merged.incentive || 0) + (merged.bonus || 0) + (merged.overtime || 0) - (merged.deductions || 0);
  return thr(await supabase.from("payroll").update({ ...patch, net_salary: Number(net.toFixed(2)) }).eq("id", id).select().single());
}
export async function deletePayroll(id) {
  return thr(await supabase.from("payroll").delete().eq("id", id));
}

/* ---------------- ledger ---------------- */
export async function listLedger({ employee_id } = {}) {
  let q = supabase.from("ledger").select("*, employee:employees(name)")
    .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  const rows = thr(await q);
  return rows.map(r => ({ ...r, employee_name: r.employee?.name }));
}
export async function ledgerBalance(employee_id) {
  const { data, error } = await supabase.rpc("ledger_balance", { p_employee_id: employee_id });
  if (error) throw error;
  return data?.[0] || { advance: 0, allowance: 0, deduction: 0, disbursed: 0, balance: 0 };
}
export async function createLedger(payload) {
  return thr(await supabase.from("ledger").insert(payload).select().single());
}
/** Disbursements paid for a particular (employee, year, month). */
export async function listDisbursements({ employee_id, paid_for_year, paid_for_month } = {}) {
  let q = supabase.from("ledger").select("*, employee:employees(name)").eq("entry_type", "disbursement").order("entry_date", { ascending: false });
  if (employee_id) q = q.eq("employee_id", employee_id);
  if (paid_for_year) q = q.eq("paid_for_year", paid_for_year);
  if (paid_for_month) q = q.eq("paid_for_month", paid_for_month);
  const rows = thr(await q);
  return rows.map(r => ({ ...r, employee_name: r.employee?.name }));
}
export async function deleteLedger(id) {
  return thr(await supabase.from("ledger").delete().eq("id", id));
}

/* ---------------- expenses ---------------- */
export async function listExpenses({ category, date_from, date_to } = {}) {
  let q = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  if (category) q = q.eq("category", category);
  if (date_from) q = q.gte("expense_date", date_from);
  if (date_to) q = q.lte("expense_date", date_to);
  return thr(await q);
}
export async function createExpense(payload) {
  return thr(await supabase.from("expenses").insert(payload).select().single());
}
export async function updateExpense(id, patch) {
  return thr(await supabase.from("expenses").update(patch).eq("id", id).select().single());
}
export async function deleteExpense(id) {
  return thr(await supabase.from("expenses").delete().eq("id", id));
}

/* ---------------- company settings ---------------- */
export async function getCompanySettings() {
  const r = await supabase.from("company_settings").select("*").eq("id", "default").maybeSingle();
  if (r.error) throw r.error;
  return r.data || null;
}
export async function updateCompanySettings(patch) {
  return thr(await supabase.from("company_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", "default").select().single());
}

/* ---------------- live salary (RPCs) ---------------- */
export async function liveSalary(employee_id, year, month) {
  const { data, error } = await supabase.rpc("live_salary", { p_employee_id: employee_id, p_year: Number(year), p_month: Number(month) });
  if (error) throw error;
  return data?.[0] || { present_days: 0, half_days: 0, absent_days: 0, base_salary: 0, allowance: 0, deductions: 0, advance: 0, net_live: 0 };
}
export async function livePayrollTotal(year, month) {
  const { data, error } = await supabase.rpc("live_payroll_total", { p_year: Number(year), p_month: Number(month) });
  if (error) throw error;
  return data?.[0] || { employee_count: 0, total_base: 0, total_allowance: 0, total_advance: 0, total_deductions: 0, total_net: 0 };
}

/* ---------------- dashboard (client-side aggregation) ---------------- */
export async function getDashboard(user) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  if (user.role === "admin" || user.role === "manager") {
    const [emps, attToday, visitsToday, visitsAll, expMonth, payMonth, recentVisits] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("attendance").select("status").eq("date", today),
      supabase.from("visits").select("id", { count: "exact", head: true }).gte("visit_date", today),
      supabase.from("visits").select("visit_type"),
      supabase.from("expenses").select("amount").gte("expense_date", monthStart),
      supabase.from("payroll").select("net_salary").eq("month", month).eq("year", year),
      supabase.from("visits").select("*, employee:employees(name)").order("visit_date", { ascending: false }).limit(5),
    ]);
    const att = {};
    (attToday.data || []).forEach(r => { att[r.status] = (att[r.status] || 0) + 1; });
    const vtype = {};
    (visitsAll.data || []).forEach(r => { vtype[r.visit_type] = (vtype[r.visit_type] || 0) + 1; });
    return {
      role: user.role,
      total_employees: emps.count || 0,
      attendance_today: att,
      visits_today: visitsToday.count || 0,
      visits_total: (visitsAll.data || []).length,
      visit_type_breakdown: vtype,
      expenses_this_month: (expMonth.data || []).reduce((s, e) => s + (e.amount || 0), 0),
      payroll_this_month: (payMonth.data || []).reduce((s, p) => s + (p.net_salary || 0), 0),
      recent_visits: (recentVisits.data || []).map(v => ({ ...v, employee_name: v.employee?.name })),
      top_employees_by_visits: [], // simplified
    };
  }
  // employee
  const [attMonth, myToday, visitsToday, visitsMonth, recentVisits, payroll] = await Promise.all([
    supabase.from("attendance").select("status").eq("employee_id", user.id).gte("date", monthStart),
    supabase.from("attendance").select("*").eq("employee_id", user.id).eq("date", today).maybeSingle(),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("employee_id", user.id).gte("visit_date", today),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("employee_id", user.id).gte("visit_date", monthStart),
    supabase.from("visits").select("*").eq("employee_id", user.id).order("visit_date", { ascending: false }).limit(5),
    supabase.from("payroll").select("*").eq("employee_id", user.id).eq("month", month).eq("year", year).maybeSingle(),
  ]);
  const att = {};
  (attMonth.data || []).forEach(r => { att[r.status] = (att[r.status] || 0) + 1; });
  return {
    role: "employee",
    today_attendance: myToday.data,
    attendance_summary: att,
    visits_today: visitsToday.count || 0,
    visits_this_month: visitsMonth.count || 0,
    recent_visits: recentVisits.data || [],
    current_payroll: payroll.data,
  };
}
