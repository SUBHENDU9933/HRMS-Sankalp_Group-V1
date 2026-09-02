# Recruitment Module — Shared AI Changelog

**Why this file exists:** Both Claude and ChatGPT are actively making changes to this app.
Git only captures *frontend* file changes. It does **not** capture Supabase database
schema, RPC functions, or Edge Function deployments, which happen directly against
the live Supabase project and are invisible to a normal repo diff. This file is the
single place both AI assistants (and Subhendu) can see the complete picture:
frontend + database + backend functions together.

**Rule for both assistants:** Before making changes to the recruitment system, read
this file first — especially the "Current State" section. After making changes, add a dated entry to the Change Log section below (newest on top), and update "Current State" if you added/changed a table column, RPC, or Edge Function.

---

## Current State Snapshot (living section — keep this updated)

### Supabase Edge Functions (project: myeackkcbdiuwyyslcof)
- **`recruitment-email`** — the single email-sending function. Handles all 6 event kinds:
  `submitted`, `shortlisted`, `interview_scheduled`, `interview_rescheduled`, `selected`,
  `rejected`. Gmail SMTP. One shared HTML template system (Royal Blue `#0D47A1` / Orange
  `#FF6A00`). Idempotency guard via `last_emailed_kind` + `last_email_status` columns on
  `job_applications` (skips duplicate sends unless `force:true`). Sanitizes all dynamic
  content through `asciiSafe()` to prevent SMTP quoted-printable corruption. **Version 22 (ACTIVE).**
- **`recruitment-email-rescheduled`** — legacy compatibility wrapper, **Version 2 (ACTIVE)**.
  Older deployed frontend builds can still call this slug; it forwards to `recruitment-email`
  with `kind=interview_rescheduled` and `force=true`, so rescheduled email uses the exact
  same shared template/design/footer as all other recruitment emails.

### Key Supabase RPCs (all SECURITY DEFINER, public schema)
- `submit_application(...)` — public application submission.
- `change_application_status(...)` — the ONLY way status/interview/joining fields change; admin/manager only; logs to `application_status_history`.
- `reassign_application(...)` — move an application to a different opening and reset to `new` while keeping history.
- `mark_application_converted(...)` — idempotent conversion guard.
- `update_application_notes(...)` — HR notes.
- `update_application_details(...)` — manager/admin manual correction of submitted candidate details with audit history.
- `delete_application(...)` — admin-only application deletion with UI confirmation.
- `get_recruitment_dashboard_stats()` — manager/admin aggregate dashboard RPC. Returns KPI counts, status distribution, last-30-day application trend, Today intelligence, upcoming interviews, recent activity, and top-position counts in one response.
- `check_duplicate_application(...)` — public pre-submit duplicate check.
- `check_application_status(...)` — public status lookup.
- `upsert_job_opening(...)` — admin-only job posting create/update.
- `set_application_number()` — BEFORE INSERT trigger generating `APP-<year>-<job code>-<4 random digits><random letter>`.

### Key tables
- `job_openings` — title, department, employment_type, experience_required, salary_range, location, work_type, description, responsibilities, eligibility, skills, compensation_type, code, status.
- `job_applications` — applicant record + interview/joining/conversion fields + geolocation + email tracking.
- `application_status_history` — full audit trail of every status change.

### Status pipeline
`new → shortlisted → interview_scheduled (→ interview_rescheduled any number of times) → interviewed → selected → joining → (Convert to Employee)`
Side paths: `on_hold` (→ Reassign to a different opening), `rejected` (terminal).

### Frontend pages
- `pages/Apply.jsx` — public application form (`/apply`)
- `pages/PublicStatus.jsx` — public status checker (`/status`)
- `pages/Recruitment.jsx`, `ApplicationDetail.jsx`, `JobOpenings.jsx` — admin recruitment UI
- `lib/recruitment.js` — all recruitment data-access functions, including dashboard stats wrapper
- `components/PhotoCapture.jsx`, `components/LocationMapTile.jsx` — shared UI

### Recruitment Dashboard
- `/recruitment` is a premium **Recruitment Command Center** using live production data only.
- Management view includes clickable KPI cards for Total Applications, New, Shortlisted, Interviews Scheduled, and Selected/Hired.
- **Upcoming Interviews** has clickable candidate rows plus a **View all** action that filters the application queue to upcoming interviews.
- **Latest Applications** initially shows 10 records per page, with Previous/Next pagination for older applications.
- Latest Applications supports search across candidate name, email, phone, application number, and position; status and position filters; interview filters (today/upcoming/no interview); applied-date range filters; CSV export; clear-all filters; multi-select; bulk status changes; automated email actions where a matching recruitment email template exists; and WhatsApp message actions using the existing manual WhatsApp generator.
- Bulk status changes use the existing `change_application_status()` RPC for every selected application, preserving the normal audit/history workflow. Interview Scheduled requires a date/time, and Joining Confirmed requires a joining date.
- Selected/Hired KPI/filter groups `selected` and `joining` applications so the KPI is directly actionable.
- Recent Activity reuses `application_status_history`; no activity table was created.
- No new Supabase tables, columns, RPCs, or Edge Functions were added for this dashboard pass.

### Brand assets
- Logo: `https://emp.sankalpdesign.com/sankalp-group-logo-email.png`
- Colors: Royal Blue `#0D47A1`, Orange `#FF6A00`
- Recruitment email footer: 50/50 split with logo/socials on the left, HR Desk contacts on the right,
  and full-width office/interview-venue address + Google Maps action below.

### Current job openings
10 active/open roles: `RLE`, `RLM`, `SKD`, `TEL`, `FRL`, `PCS`, `SME`, `BDE`, `BDM`, `WFH`.

---

## Change Log (newest first)
### 2026-09-02 — ChatGPT
- **Made the Recruitment Command Center fully actionable from the dashboard.**
- Made all five top KPI cards clickable so management can immediately open the corresponding application queue.
- Made Upcoming Interviews candidate rows clickable and added a View All action that opens the full upcoming-interview queue.
- Rebuilt Latest Applications as a real working queue: 10 records per page initially, older records available through pagination, plus status/position/interview/date/search filters and CSV export.
- Added multi-select checkboxes and a bulk-action toolbar for status change, email, and WhatsApp.
- Added a bulk status dialog with interview date/time and joining-date requirements where needed; each status update still uses the existing `change_application_status()` RPC and audit history.
- Added per-candidate automated email and WhatsApp actions using the existing recruitment email sender and manual WhatsApp generator.
- Added a Selected/Hired filter grouping `selected` + `joining` so that KPI is directly actionable.
- Changed dashboard-side application searching to include position/title as well as candidate/contact/application reference fields.
- **Supabase:** no schema/RPC/Edge Function changes.
- **Git commits:** `9329c1ff7ab9f061f93ecd1d2f8ac1b4d60d9f0f` (dashboard) and `59a55c50bd812f304daeafbd4854ecc09f790c10` (data-access search/filter support).

### 2026-09-02 — ChatGPT
- **Expanded the Recruitment Command Center into a management-intelligence view.**
- Added real action-priority queues for overdue interviews, shortlisted candidates waiting for scheduling, interviewed candidates waiting for a decision, and selected candidates waiting for joining.
- Added live top-position application distribution and a live conversion-rate metric.
- Added overdue interview, selected-pending-joining, on-hold, and other Today intelligence metrics to `get_recruitment_dashboard_stats()`.
- Kept all action items derived from existing `job_applications` and `application_status_history`; no fake/demo data and no new activity table.
- Refined the `/recruitment` frontend into a focused management command center while preserving existing search, filters, application detail navigation, email action, CSV export, upcoming interviews, and status workflow.
- Updated the shared changelog so Claude can continue from this exact state.
- **Supabase:** updated existing `get_recruitment_dashboard_stats()` only; no tables or columns were added/changed.

### 2026-09-02 — ChatGPT
- **Built the first production pass of the premium Recruitment Command Center** at `/recruitment`.
- Added KPI cards, status distribution, 30-day trend, pipeline intelligence, Today metrics, upcoming interviews, recent activity, filters, responsive application table, refresh, and CSV export.
- Added the manager/admin-only `get_recruitment_dashboard_stats()` RPC and the frontend `getRecruitmentDashboardStats()` wrapper.
- All metrics use live Supabase data; no demo candidate numbers, interviews, trends, or activity were introduced.

### 2026-09-01 — Claude
- Fixed the recruitment HR Desk email address typo in live `recruitment-email` (version 22), changing the hardcoded address to `care.sankalpgrp@gmail.com` while keeping the recruitment-specific phone number unchanged.
- Confirmed the email contact block is hardcoded in the Edge Function and therefore does not automatically follow Company Settings changes.

### 2026-09-01 — Claude
- Added manual application-detail correction and admin-only deletion through `update_application_details(...)` and `delete_application(...)`, with audit history and type-DELETE confirmation.

### 2026-09-01 — ChatGPT
- Unified the legacy `recruitment-email-rescheduled` route with the shared recruitment email design through Version 2 compatibility forwarding to `recruitment-email` with `kind=interview_rescheduled` and `force=true`.

### 2026-09-01 — ChatGPT
- Redesigned the shared recruitment email footer in `recruitment-email` version 21 with a 50/50 logo/social + HR Desk layout and full-width office address/map row.

### 2026-09-01 — ChatGPT
- Created the open `Work From Home — Freelance / Project-Based Associate` role (`WFH`) using the existing `job_openings` structure.

### 2026-09-01 — Claude
- Corrected the public application page browser title to `Apply for Your Desired Job — SANKALP GROUP`.

### 2026-09-01 — Claude
- Consolidated the interview-reschedule email flow into the main `recruitment-email` function as the sixth template kind, `interview_rescheduled`.

### 2026-08-31 — Claude
- Completed application-number redesign, job codes, job-opening save-field fix, brand-logo replacement, SMTP ASCII sanitization, mandatory geolocation, richer public form/status checker, qualification rules, joining/reschedule/on-hold workflow, and premium public recruitment pages.

### 2026-08-30 — Claude
- Initial recruitment module build: public application form, admin dashboard/list/detail/job openings, DB/RLS/RPC layer, Gmail SMTP recruitment email templates, and manual WhatsApp message generator.

---

## For ChatGPT (or whoever reads this next)
If you're an AI assistant working on this repo: please read the "Current State" section above before changing anything in the recruitment module, and add a dated entry to the Change Log when you're done — especially if you touch Supabase (tables, columns, RPCs, Edge Functions), since none of that shows up in git.
