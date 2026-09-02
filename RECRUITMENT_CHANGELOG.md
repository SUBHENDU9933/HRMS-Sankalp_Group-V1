# Recruitment Module — Shared AI Changelog

**Why this file exists:** Both Claude and ChatGPT are actively making changes to this app.
Git only captures *frontend* file changes. It does **not** capture Supabase database
schema, RPC functions, or Edge Function deployments — those happen directly against
the live Supabase project and are invisible to a normal repo diff. This file is the
single place both AI assistants (and Subhendu) can see the *complete* picture:
frontend + database + backend functions together.

**Rule for both assistants:** Before making changes to the recruitment system, read
this file first — especially the "Current State" section. After making changes, add a dated entry to the Change Log section below (newest on top), and update "Current State" if you added/changed a table column, RPC, or Edge Function.

---

## Current State Snapshot (living section — keep this updated)

### Supabase Edge Functions (project: myeackkcbdiuwyyslcof)
- **`recruitment-email`** — the single email-sending function. Handles all 6 event
  kinds: `submitted`, `shortlisted`, `interview_scheduled`, `interview_rescheduled`,
  `selected`, `rejected`. Gmail SMTP. One shared HTML template system (Royal Blue
  `#0D47A1` / Orange `#FF6A00` brand). Idempotency guard via `last_emailed_kind` +
  `last_email_status` columns on `job_applications` (skips duplicate sends unless
  `force:true`). Sanitizes all dynamic content through `asciiSafe()` to prevent SMTP
  quoted-printable corruption from non-ASCII typographic characters. **Version 22 (ACTIVE).**
- **`recruitment-email-rescheduled`** — legacy compatibility wrapper, **Version 2 (ACTIVE)**.
  Older deployed frontend builds can still call this slug; it forwards the request
  to `recruitment-email` with `kind=interview_rescheduled` and `force=true`, so the
  rescheduled email uses the exact same shared template/design/footer as all other
  recruitment emails. It does not maintain a separate email template.

### Key Supabase RPCs (all SECURITY DEFINER, public schema)
- `submit_application(...)` — public application submission (bypasses RLS SELECT
  restriction so the candidate gets their application_number back)
- `change_application_status(...)` — the ONLY way status/interview/joining fields
  change. Admin/manager only. Logs to `application_status_history`.
- `reassign_application(...)` — move an on-hold (or any) application to a different
  job opening, resets to status='new', keeps full history on the same row.
- `mark_application_converted(...)` — idempotent guard against double-converting
  an application to an employee record.
- `update_application_notes(...)` — HR notes, separate from status pipeline.
- `update_application_details(...)` — manager/admin manual correction of submitted
  candidate details, with audit history.
- `delete_application(...)` — admin-only application deletion with UI confirmation.
- `get_recruitment_dashboard_stats()` — manager/admin aggregate dashboard RPC. Returns
  KPI counts, current status distribution, last-30-day application trend, Today
  intelligence counts, upcoming interviews, and recent status-history activity in
  one response to avoid multiple dashboard aggregation round trips.
- `check_duplicate_application(...)` — public, pre-submit duplicate check.
- `check_application_status(...)` — public, requires application_number + (email
  OR phone), returns full submitted details + status.
- `upsert_job_opening(...)` — admin-only job posting create/update.
- `set_application_number()` — BEFORE INSERT trigger on `job_applications`.
  Generates `APP-<year>-<job code>-<4 random digits><random letter>`. Job code
  comes from `job_openings.code` (3-4 letters, unique, admin-editable).

### Key tables
- `job_openings` — title, department, employment_type, experience_required,
  salary_range, location, work_type, description, responsibilities, eligibility,
  skills, compensation_type, code, status (open/closed)
- `job_applications` — full applicant record + status pipeline fields
  (interview_date/time/mode/interviewer/feedback/rating, joining_date,
  converted_employee_id) + geolocation (latitude/longitude/location_accuracy,
  mandatory on public form) + email tracking (last_emailed_kind,
  last_email_status, last_email_sent_at, last_email_error)
- `application_status_history` — full audit trail of every status change

### Status pipeline
`new → shortlisted → interview_scheduled (→ interview_rescheduled any number of
 times) → interviewed → selected → joining → (Convert to Employee)`
Side paths: `on_hold` (→ Reassign to a different opening), `rejected` (terminal)

### Frontend pages (all in `frontend/src/`)
- `pages/Apply.jsx` — public application form (`/apply`)
- `pages/PublicStatus.jsx` — public status checker (`/status`)
- `pages/Recruitment.jsx`, `ApplicationDetail.jsx`, `JobOpenings.jsx` — admin recruitment UI
- `lib/recruitment.js` — all data-access functions (Supabase calls, RPC wrappers), including dashboard stats
- `components/PhotoCapture.jsx`, `components/LocationMapTile.jsx` — shared UI

### Recruitment Dashboard
- `/recruitment` is now a premium **Recruitment Command Center** rather than a basic application list.
- Uses real Supabase data only: KPI cards, status distribution, 30-day trend, current pipeline,
  Today intelligence, upcoming interviews, recent status activity, filters, application table,
  clickable status filtering, application detail/email actions, and CSV export of the current filtered list.
- Dashboard uses `get_recruitment_dashboard_stats()` for aggregate metrics and reuses the existing
  `listApplications()` flow for the detailed application list. No duplicate recruitment workflow or email system was introduced.
- Recent Activity is based on the existing `application_status_history` audit trail; no new activity table was created.

### Brand assets
- Logo (same file used everywhere — apply/status pages + all emails):
  `https://emp.sankalpdesign.com/sankalp-group-logo-email.png`
- Colors: Royal Blue `#0D47A1`, Orange `#FF6A00`
- Email footer: 50/50 split. Left side contains the Sankalp Group logo and clickable
  social icons (Facebook, Instagram, Threads, YouTube). Right side contains
  **HR Desk • Urgent Matters Only**, clickable phone/WhatsApp `8910546151`,
  `care.sankalpgrp@gmail.com`, and `sankalpinterior.com`. A full-width office/
  interview-venue row below contains a clickable map-pin and address plus
  **View Office on Google Maps →** linking to
  `https://maps.app.goo.gl/kuycqqXVfVfPmZBb7`.

### Current job openings
10 active/open roles are currently listed, including the new `WFH` role:
`RLE`, `RLM`, `SKD`, `TEL`, `FRL`, `PCS`, `SME`, `BDE`, `BDM`, `WFH`.

---

## Change Log (newest first)
### 2026-09-02 — ChatGPT
- **Built the first production pass of the premium Recruitment Command Center** at `/recruitment`.
- Read the shared changelog first and followed the two-assistant coordination rules.
- Replaced the previous basic recruitment list UI with a premium Sankalp-branded dashboard: KPI cards, status distribution donut, 30-day application trend, recruitment pipeline, Today intelligence, quick actions, upcoming interviews, recent activity, advanced search/filter presentation, responsive application table, clickable status filtering, application detail/email actions, loading/empty states, refresh, and CSV export.
- All dashboard metrics are sourced from live Supabase data; no demo/fake candidate numbers, interview records, trends, or activity were introduced.
- Added `getRecruitmentDashboardStats()` to `frontend/src/lib/recruitment.js` as the data-access wrapper for the new aggregate RPC.
- Added the new SECURITY DEFINER RPC `get_recruitment_dashboard_stats()` in Supabase. It is manager/admin-only and returns KPI counts, status counts, 30-day application trend, Today intelligence, upcoming interviews, and recent status activity in one response.
- Recent Activity reuses the existing `application_status_history` audit trail. No activity table was added.
- Existing `change_application_status(...)`, application detail page, recruitment email system, job-opening workflow, and status pipeline remain unchanged.
- No database tables or columns were added or modified.

### 2026-09-01 — Claude
- **Fixed the recruitment HR Desk email address typo** in the live
  `recruitment-email` function (deployed as version 22). Was hardcoded as
  `care.sankalpgp@gmail.com` (missing the "r") in ChatGPT's footer redesign
  (v21) — confirmed with Subhendu and corrected to `care.sankalpgrp@gmail.com`.
  Confirmed with Subhendu that the phone number `8910546151` is intentionally
  the recruitment-specific HR Desk number (distinct from the general company
  phone `9748297025` used elsewhere in the app) — left unchanged. Everything
  else in ChatGPT's v21 rewrite (layout, hardcoded contact block instead of
  pulling from `company_settings`, address, map link, all 6 email templates)
  was left exactly as-is — this was a single-string surgical fix, not a
  revert or rewrite.
- **Known limitation, not fixed (flagging for awareness):** contact info in
  this function is now hardcoded rather than pulled from `company_settings`
  like the original design. If the office address/website/email ever change,
  someone needs to edit the Edge Function source directly — it won't pick up
  changes made via the Company Settings page anymore. Not touching this
  without being asked, since it works correctly as long as the hardcoded
  values stay accurate.

### 2026-09-01 — Claude
- **New: manual edit + delete for submitted applications.** Admin/manager can
  now correct candidate-submitted details (name/email/phone/experience/company/
  education/address/expected salary/cover note) directly from Application
  Detail — for cases where the candidate couldn't fill every field correctly
  and HR updates it from the CV or a follow-up call. New RPC:
  `update_application_details(...)` (manager/admin, logs an audit entry to
  `application_status_history`). Also added application deletion: new RPC
  `delete_application(...)` (admin-only), type-"DELETE"-to-confirm in the UI.
  Storage files (CV/photo) are intentionally NOT deleted — left in place to
  avoid accidental data loss from a mis-scoped storage call.

### 2026-09-01 — ChatGPT
- **Unified the legacy reschedule-email route with the shared recruitment email design.**
- Investigated the live Supabase Edge Function logs and found that `recruitment-email-rescheduled`
  was still receiving POST requests from an older/stale frontend path, even though the current
  `recruitment-email` function is the documented consolidated email sender.
- Deployed **`recruitment-email-rescheduled` Version 2** as a compatibility wrapper. It forwards
  the same `application_id` to `recruitment-email` with `kind=interview_rescheduled` and `force=true`.
- Result: whether the current frontend or an older deployed frontend invokes the reschedule route,
  the candidate receives the **same shared premium HTML template, header, info-card styling,
  50/50 footer, social icons, HR Desk contacts, office address, and Google Maps link** used by the
  other recruitment email templates. Only the reschedule-specific wording/data changes.
- No database schema, RPC, application data, or recruitment workflow was changed.

### 2026-09-01 — ChatGPT
- **Redesigned the shared recruitment email footer** in live Supabase Edge Function
  `recruitment-email` (deployed as version 21).
- Footer is now a responsive **50% / 50%** layout: left side contains the current
  Sankalp Group logo and clickable social icons (Facebook, Instagram, Threads, YouTube);
  right side contains **HR Desk • Urgent Matters Only**, Call / WhatsApp `8910546151`,
  `care.sankalpgp@gmail.com`, and `sankalpinterior.com` as clickable contact links.
- Added a full-width **Office Address / Interview Venue** section beneath the two columns.
- Kept the existing Sankalp Group logo asset, Royal Blue/Orange brand system, six email event
  kinds, idempotency behavior, and SMTP flow intact. No database schema, RPC, or application-data changes were made.

### 2026-09-01 — ChatGPT
- **Created new open job role:** `Work From Home — Freelance / Project-Based Associate` (`WFH`).
- Purpose: flexible work-from-home opportunity for freelancers/independent professionals who can handle specific assignments, projects, task-based work, or commission/incentive-based work.
- Employment type: **Freelance / Project-Based / Commission**.
- Work type: **Remote / Work From Home — Physical Interview Required**.
- Candidates must **apply online through the official recruitment form** and **attend a physical interview at the Sankalp Group office in Kolkata**. Exact assignment, scope, deliverables, timeline, and remuneration are decided only after interview and discussion.
- Compensation: **Project / Assignment / Commission Based — remuneration decided after interview & discussion**; no fixed salary was promised.
- Added directly to Supabase `job_openings` using the existing job-opening data structure. No table, RPC, Edge Function, email template, or frontend schema changes were made.

### 2026-09-01 — Claude
- **Fixed grammar** in the browser tab title ChatGPT set earlier that day. Final:
  "Apply for Your Desired Job — SANKALP GROUP".

### 2026-09-01 — ChatGPT
- **Updated public application page browser title** and recruitment-focused meta description. No Supabase tables, RPCs, Edge Functions, email triggers, or application data were changed.

### 2026-09-01 — Claude
- **Consolidated reschedule emails.** Merged the standalone reschedule email function into
  the main `recruitment-email` function as a 6th template kind (`interview_rescheduled`).
  `recruitment.js`'s `sendStatusEmail()` targets `recruitment-email` using
  `supabase.functions.invoke()`.

### 2026-09-01 — ChatGPT (reconstructed from git commits, not directly observed)
- Built interview-reschedule email notifications and later consolidated them with Claude's
  shared recruitment email implementation.

### 2026-08-31 — Claude
- Full application number redesign: `APP-2026-<CODE>-<4 digits><letter>`, random + guaranteed-unique via BEFORE INSERT trigger. Assigned job codes to all 9 original postings.
- Fixed Job Openings save fields for Work Type/Responsibilities/Skills/Eligibility.
- Replaced brand logo everywhere with the new navy/gold SANKALP GROUP wordmark.
- Fixed SMTP subject/body corruption caused by non-ASCII typographic characters using `asciiSafe()` sanitization.
- Added mandatory public-form geolocation capture and application address/declaration improvements.
- Created/updated job openings with full details and qualification rules.
- Added status pipeline support for on-hold/reassign, joining, and interview rescheduling.
- Added public status checker and premium `/apply` + `/status` redesign.

### 2026-08-30 — Claude
- Initial recruitment module build: job application form, admin dashboard (list/detail/job openings), full DB schema + RLS + RPCs, Gmail SMTP email system with branded HTML templates, WhatsApp message generator (manual send).

---

## For ChatGPT (or whoever reads this next)
If you're an AI assistant working on this repo: please read the "Current State" section above before changing anything in the recruitment module, and add a dated entry to the Change Log when you're done — especially if you touch Supabase (tables, columns, RPCs, Edge Functions), since none of that shows up in git.
