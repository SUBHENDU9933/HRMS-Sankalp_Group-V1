/**
 * Recruitment module data access layer — same thin-wrapper pattern as lib/data.js.
 * Status changes NEVER go through a raw .update() — always via the change_application_status
 * RPC, which is the single choke point for status-history logging + email triggers.
 */
import { supabase, uploadFile } from "./supabase";
export { uploadFile };

const thr = (r) => { if (r.error) throw r.error; return r.data; };

/* ---------------- public (no auth — used on /apply) ---------------- */
export async function listOpenPositions() {
  return thr(await supabase.from("job_openings").select("id,title,department,description,employment_type,experience_required,salary_range,location,work_type,responsibilities,skills,eligibility").eq("status", "open").order("title"));
}
export async function checkDuplicateApplication(job_opening_id, email, phone) {
  const { data, error } = await supabase.rpc("check_duplicate_application", {
    p_job_opening_id: job_opening_id, p_email: email, p_phone: phone,
  });
  if (error) throw error;
  return data?.[0] || null;
}
export async function checkApplicationStatus(application_number, email, phone) {
  const { data, error } = await supabase.rpc("check_application_status", {
    p_application_number: application_number.trim(),
    p_email: email ? email.trim() : null,
    p_phone: phone ? phone.trim() : null,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function submitApplication(p) {
  const { data, error } = await supabase.rpc("submit_application", {
    p_job_opening_id: p.job_opening_id,
    p_name: p.name,
    p_email: p.email,
    p_phone: p.phone,
    p_experience_years: p.experience_years ?? null,
    p_current_company: p.current_company || null,
    p_education: p.education || null,
    p_current_address: p.current_address || null,
    p_expected_salary: p.expected_salary ?? null,
    p_cover_note: p.cover_note || null,
    p_cv_url: p.cv_url,
    p_photo_url: p.photo_url || null,
    p_latitude: p.latitude ?? null,
    p_longitude: p.longitude ?? null,
    p_location_accuracy: p.location_accuracy ?? null,
  });
  if (error) throw error;
  return data;
}

/* ---------------- admin: job openings ---------------- */
export async function listJobOpenings() {
  return thr(await supabase.from("job_openings").select("*").order("created_at", { ascending: false }));
}
export async function saveJobOpening({ id, title, department, description, status, employment_type, experience_required, salary_range, location, work_type, responsibilities, eligibility, skills, compensation_type, code }) {
  const { data, error } = await supabase.rpc("upsert_job_opening", {
    p_id: id || null, p_title: title, p_department: department || null,
    p_description: description || null, p_status: status || "open",
    p_employment_type: employment_type || null, p_experience_required: experience_required || null,
    p_salary_range: salary_range || null, p_location: location || null,
    p_work_type: work_type || null, p_responsibilities: responsibilities || null,
    p_eligibility: eligibility || null, p_skills: skills || null,
    p_compensation_type: compensation_type || null, p_code: code || null,
  });
  if (error) throw error;
  return data;
}

/* ---------------- admin: applications ---------------- */
export async function listApplications({ q = "", status = "", job_opening_id = "" } = {}) {
  let query = supabase.from("job_applications")
    .select("*, job_opening:job_openings(title), interviewer_employee:employees!job_applications_interviewer_fkey(name)")
    .order("applied_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (job_opening_id) query = query.eq("job_opening_id", job_opening_id);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,application_number.ilike.%${q}%`);
  const rows = thr(await query);
  return rows.map(r => ({ ...r, job_title: r.job_opening?.title, interviewer_name: r.interviewer_employee?.name }));
}
export async function getApplication(id) {
  const r = thr(await supabase.from("job_applications")
    .select("*, job_opening:job_openings(title), interviewer_employee:employees!job_applications_interviewer_fkey(name)")
    .eq("id", id).single());
  return { ...r, job_title: r.job_opening?.title, interviewer_name: r.interviewer_employee?.name };
}
export async function getApplicationHistory(application_id) {
  return thr(await supabase.from("application_status_history")
    .select("*, actor:employees(name)").eq("application_id", application_id)
    .order("changed_at", { ascending: false }));
}
export async function changeStatus(args) {
  const { data, error } = await supabase.rpc("change_application_status", {
    p_application_id: args.application_id,
    p_new_status: args.new_status,
    p_note: args.note || null,
    p_interview_date: args.interview_date || null,
    p_interview_time: args.interview_time || null,
    p_interview_mode: args.interview_mode || null,
    p_interviewer: args.interviewer || null,
    p_interview_feedback: args.interview_feedback || null,
    p_interview_rating: args.interview_rating || null,
    p_joining_date: args.joining_date || null,
  });
  if (error) throw error;
  return data;
}

export async function reassignApplication(application_id, new_job_opening_id, note) {
  const { data, error } = await supabase.rpc("reassign_application", {
    p_application_id: application_id, p_new_job_opening_id: new_job_opening_id, p_note: note || null,
  });
  if (error) throw error;
  return data;
}
export async function updateNotes(application_id, hr_notes) {
  const { data, error } = await supabase.rpc("update_application_notes", {
    p_application_id: application_id, p_hr_notes: hr_notes,
  });
  if (error) throw error;
  return data;
}
export async function markConverted(application_id, employee_id) {
  const { data, error } = await supabase.rpc("mark_application_converted", {
    p_application_id: application_id, p_employee_id: employee_id,
  });
  if (error) throw error;
  return data;
}

/* ---------------- email (best-effort, never blocks status change) ---------------- */
export async function sendStatusEmail(application_id, kind, force = false) {
  try {
    // Backward compatibility: the current deployed recruitment-email Edge Function
    // accepts interview_scheduled, while older/newer frontend code may call the
    // more explicit interview_rescheduled event. A reschedule must bypass the
    // normal idempotency guard so the candidate receives the new interview details.
    const isReschedule = kind === "interview_rescheduled";
    const apiKind = isReschedule ? "interview_scheduled" : kind;
    const apiForce = isReschedule ? true : force;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/recruitment-email`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ application_id, kind: apiKind, force: apiForce }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || "Email send failed");
    return body;
  } catch (e) {
    // Non-fatal — status already changed. Caller shows a toast warning.
    return { ok: false, error: e.message };
  }
}

/* ---------------- WhatsApp message generator (manual send — no API) ---------------- */
const WA_STATUS_TEXT = {
  shortlisted: (a) => `Hi ${a.name}, good news! You've been shortlisted for the ${a.job_title} position at Sankalp Group. We'll be in touch soon with next steps.\n\nRef: ${a.application_number}`,
  interview_scheduled: (a) => `Hi ${a.name}, your interview for ${a.job_title} is scheduled on ${a.interview_date} at ${a.interview_time} (${a.interview_mode}).${a.interview_mode === "in_person" ? "\nLocation: " + (a.mapUrl || "") : ""}\n\nRef: ${a.application_number}`,
  selected: (a) => `Congratulations ${a.name}! You've been selected for the ${a.job_title} position at Sankalp Group. Our HR team will reach out with joining details soon.\n\nRef: ${a.application_number}`,
  joining: (a) => `Hi ${a.name}, your joining for ${a.job_title} at Sankalp Group is confirmed for ${a.joining_date}. Welcome aboard!\n\nRef: ${a.application_number}`,
  rejected: (a) => `Hi ${a.name}, thank you for applying for ${a.job_title} at Sankalp Group. After careful consideration, we won't be moving forward this time. We wish you the best in your search.\n\nRef: ${a.application_number}`,
  on_hold: (a) => `Hi ${a.name}, your application for ${a.job_title} at Sankalp Group is currently on hold. We'll update you as soon as there's news.\n\nRef: ${a.application_number}`,
};

export function generateWhatsAppMessage(app, kind, mapUrl) {
  const builder = WA_STATUS_TEXT[kind];
  if (!builder) return "";
  return builder({ ...app, mapUrl });
}

export function whatsappLink(phone, message) {
  const digits = (phone || "").replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits; // assume Indian numbers
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}