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
  quoted-printable corruption from non-ASCII typographic characters. **Version 21 (ACTIVE).**
- **`recruitment-email-rescheduled`** — legacy compatibility wrapper, **Version 2 (ACTIVE)**.
  Older deployed frontend builds can still call this slug; it now forwards the request
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
- `pages/Recruitment.jsx`, `ApplicationDetail.jsx`, `JobOpenings.jsx` — admin dashboard
- `lib/recruitment.js` — all data-access functions (Supabase calls, RPC wrappers)
- `components/PhotoCapture.jsx`, `components/LocationMapTile.jsx` — shared UI

### Brand assets
- Logo (same file used everywhere — apply/status pages + all emails):
  `https://emp.sankalpdesign.com/sankalp-group-logo-email.png`
- Colors: Royal Blue `#0D47A1`, Orange `#FF6A00`
- Email footer: 50/50 split. Left side contains the Sankalp Group logo and clickable
  social icons (Facebook, Instagram, Threads, YouTube). Right side contains
  **HR Desk • Urgent Matters Only**, clickable phone/WhatsApp `8910546151`,
  `care.sankalpgp@gmail.com`, and `sankalpinterior.com`. A full-width office/
  interview-venue row below contains a clickable map-pin and address plus
  **View Office on Google Maps →** linking to
  `https://maps.app.goo.gl/kuycqqXVfVfPmZBb7`.

### Current job openings
10 active/open roles are currently listed, including the new `WFH` role:
`RLE`, `RLM`, `SKD`, `TEL`, `FRL`, `PCS`, `SME`, `BDE`, `BDM`, `WFH`.

---

## Change Log (newest first)

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
  Sankalp Group logo and clickable social icons (Facebook, Instagram, Threads,
  YouTube); right side contains **HR Desk • Urgent Matters Only**, Call / WhatsApp
  `8910546151`, `care.sankalpgp@gmail.com`, and `sankalpinterior.com` as clickable
  contact links.
- Added a full-width **Office Address / Interview Venue** section beneath the two
  columns. The address and **View Office on Google Maps →** action both link to
  `https://maps.app.goo.gl/kuycqqXVfVfPmZBb7`, with a map-pin icon.
- Kept the existing Sankalp Group logo asset, Royal Blue/Orange brand system,
  six email event kinds, idempotency behavior, and SMTP flow intact.
- No database schema, RPC, or application-data changes were made.

### 2026-09-01 — ChatGPT
- **Created new open job role:** `Work From Home — Freelance / Project-Based Associate` (`WFH`).
- Purpose: flexible work-from-home opportunity for freelancers/independent professionals who can handle specific assignments, projects, task-based work, or commission/incentive-based work.
- Employment type: **Freelance / Project-Based / Commission**.
- Work type: **Remote / Work From Home — Physical Interview Required**.
- Candidates must **apply online through the official recruitment form** and **attend a physical interview at the Sankalp Group office in Kolkata**. The exact assignment, scope, deliverables, timeline, and remuneration are decided only after interview and discussion.
- Compensation: **Project / Assignment / Commission Based — remuneration decided after interview & discussion**; no fixed salary was promised.
- Added directly to Supabase `job_openings` using the existing job-opening data structure. No table, RPC, Edge Function, email template, or frontend schema changes were made.
- Verified the new row is `status='open'` with code `WFH`.

### 2026-09-01 — Claude
- **Fixed grammar** in the browser tab title ChatGPT set earlier that day. Final:
  "Apply for Your Desired Job — SANKALP GROUP" (was "Apply Your Desigr Job
  (Application / Career Section) - Sankalp Group" — had both a typo and a
  grammar issue). No Supabase changes.

### 2026-09-01 — ChatGPT
- **Updated public application page browser title.** Changed the global browser/tab
  title from `Sankalp Interior Solution — HRMS` to `Apply Your Desigr Job (Application /
  Career Section) - Sankalp Group`, as requested, so the `/apply` page presents the
  recruitment/career purpose more clearly when shared on WhatsApp or viewed in a browser.
- Updated the global meta description to a recruitment-focused description. No
  Supabase tables, RPCs, Edge Functions, email triggers, or application data were changed.

### 2026-09-01 — Claude
- **Consolidated reschedule emails.** Merged ChatGPT's standalone
  `recruitment-email-rescheduled` function into the main `recruitment-email`
  function as a 6th template kind (`interview_rescheduled`) on 2026-09-01.
  `recruitment.js`'s `sendStatusEmail()` targets `recruitment-email` using
  `supabase.functions.invoke()`.

### 2026-09-01 — Claude
- **Fixed grammar** in the browser tab title ChatGPT set earlier that day. Final:
  "Apply for Your Desired Job — SANKALP GROUP" (was "Apply Your Desigr Job
  (Application / Career Section) - Sankalp Group" — had both a typo and a
  grammar issue). No Supabase changes.

### 2026-09-01 — ChatGPT (reconstructed from git commits, not directly observed)
- Built interview-reschedule email notifications: detected reschedule vs
  first-time-schedule in `ApplicationDetail.jsx`'s `doChange()`, added a
  separate `recruitment-email-rescheduled` Edge Function, wired
  `sendStatusEmail()` to branch between two functions based on kind.
  (Now consolidated by Claude — see above.)

### 2026-08-31 — Claude
- Full application number redesign: `APP-2026-<CODE>-<4 digits><letter>`,
  random + guaranteed-unique via BEFORE INSERT trigger. Assigned job codes to
  all 9 postings (RLE, RLM, SKD, TEL, FRL, PCS, SME, BDE, BDM).
- Fixed a real bug: admin Job Openings form had Work Type/Responsibilities/
  Skills/Eligibility fields, but `saveJobOpening()` never sent them to the backend —
  silently dropped on every save. Fixed; verified no data was lost (no admin-UI edits
  had happened while the bug existed).
- Replaced brand logo everywhere (apply/status pages + emails) with new
  navy/gold SANKALP GROUP wordmark.
- SMTP subject/body corruption bug found and fixed: em-dashes and other
  non-ASCII typographic characters were corrupting quoted-printable encoding
  in both Subject headers and email bodies. Added `asciiSafe()` sanitization
  applied to all dynamic content (names, job titles, addresses) plus the final
  subject line as a safety net.
- Geolocation capture on `/apply` (mandatory), ported from the Business
  Management System's Agreements module (`LocationMapTile.jsx`, same OSM-tile
  self-drawn map approach). Shown on Application Detail with coordinates +
  accuracy + Google Maps link.
- Mandatory dropdowns for Experience/Education, structured 4-field address,
  mandatory declaration checkbox, richer post-submit confirmation screen
  (name/position/application number).
- Created/updated all 9 job openings with full details (description,
  responsibilities, eligibility, skills where applicable) per Subhendu's
  provided job specs. Applied qualification rules (Executive/Manager/
  Supervisor/Social Media → different minimum qualification requirements).
- Status pipeline additions: `on_hold` → Reassign to different opening,
  `joining` status + date (separate from Convert to Employee), Reschedule
  Interview panel.
- Public status checker (`/status`): 2-field lookup (application number +
  phone OR email), shows full submitted application details.
- Premium redesign of `/apply` and `/status` (hero section, numbered form
  sections, Royal Blue/Orange brand system) + matching brand colors applied
  across the admin dashboard.

### 2026-08-30 — Claude
- Initial recruitment module build: job application form, admin dashboard
  (list/detail/job openings), full DB schema + RLS + RPCs, Gmail SMTP email
  system with branded HTML templates, WhatsApp message generator (manual send).

---

## For ChatGPT (or whoever reads this next)
If you're an AI assistant working on this repo: please read the "Current State" section above before changing anything in the recruitment module, and add a dated entry to the Change Log when you're done — especially if you touch Supabase (tables, columns, RPCs, Edge Functions), since none of that shows up in git.
