# Sankalp Interior Solution — HRMS PRD

## Original Problem Statement
Build a hybrid HRMS for Sankalp Interior Solution (Sankalp Group & Business Solution) — combining Employee Management, Attendance (selfie + GPS + watermark + geofence), Payroll (live + monthly with branded payslip PDF), Field Visit Verification (Lead/Project visits), Ledger (Khata) with Quick Credit/Debit, Expenses, and Company Settings.
Tagline (Bengali): "ঘর নয়, স্বপ্ন সাজাই আমরা".

## Architecture
- **Frontend**: React 19 + Tailwind + Shadcn UI + Recharts + jsPDF (Vercel-ready)
- **Backend**: Supabase only (Auth + Postgres + Storage). No FastAPI server.
- **Auth**: Supabase Auth (email + password) with isolated client for admin-side user creation
- **Security**: Postgres RLS + SECURITY DEFINER RPCs for admin-only operations
- **Storage**: Public bucket `sankalp-files`

## User Personas
- **Admin/HR (Subhendu)**: Manages all employees, payroll, ledger, settings; sees company-wide live payroll dashboard.
- **Manager**: Views company data, marks attendance, can edit visits (no destructive ops).
- **Employee**: Marks own attendance, logs own field visits, views own live salary & ledger.

## Core Requirements (delivered Feb 2026 → May 2026)

### Originals (Feb 2026)
- ✅ Login / Logout (Supabase Auth)
- ✅ Employees CRUD (admin) + isolated signUp client (admin keeps session)
- ✅ Attendance with selfie + GPS + watermark + admin override
- ✅ Field Visits (Lead + Project) with selfie/GPS proof, site photos
- ✅ Payroll generation auto-pulling attendance + ledger
- ✅ Payslip PDF (jsPDF, branded)
- ✅ Ledger / Khata with running balance
- ✅ Expenses with category + date filters
- ✅ Mobile-first UX (bottom nav + FAB) and desktop sidebar

### May 2026 Phase (UI/UX Overhaul)
- ✅ **🪙 Live Salary card** (employee) — base + allowance − advance − deductions = net live, all auto-calculated
- ✅ **💰 Total Live Payroll** (admin) — running total across all active employees
- ✅ **📅 Attendance Calendar** (employee, month view, color-coded)
- ✅ **📅 Team Attendance Grid** (admin, multi-employee × N days)
- ✅ **💳 Quick Credit/Debit** widget on Ledger — +/− toggle, categories (Bonus/Incentive/Extra-day/Allowance/Advance/Deduction)
- ✅ **📊 Dashboard charts** — visits trend (line), expense by category (donut), top performers
- ✅ **🏢 Company Settings page** (admin) — branding, geofence, timing rules
- ✅ **🛰️ Office geofence enforcement** — out-of-radius attendance flagged `under_review` (admin approves)
- ✅ **Context-aware attendance labels** — `🏢 @ Sankalp Interior Office`, distance shown
- ✅ **🧾 Branded payslip PDF** — uses company_settings (logo, name, tagline, contact, address)
- ✅ **🎨 Vibrant orange + light blue palette**, gradients, glass cards, emoji-rich labels
- ✅ Sankalp office GPS pre-seeded (22.6179464, 88.4343189) with 100m radius

## Schema migrations applied
- `migrations/001_initial.sql` — base tables
- `migrations/002_supabase_only.sql` — RLS, SECURITY DEFINER RPCs, generate_payroll, ledger_balance, create_employee_row
- `migrations/003_company_geofence.sql` — company_settings, attendance.{attendance_type,visit_id,location_label,distance_m,under_review}, ledger.category, live_salary RPC, live_payroll_total RPC

## What's been implemented (2026-05)
- Frontend: 12 pages + 3 components (AttendanceCalendar, AdminAttendanceGrid, SelfieCapture)
- Recharts integrated for visits trend & expense pie
- Geofence math via Haversine (`lib/geo.js`)
- Admin password reset workflow via Supabase Admin API (one-time)

## Default Admin
See `/app/memory/test_credentials.md` — `info.subhendu@gmail.com`.

## Backlog (P1/P2)
### P1
- Admin "Approve out-of-geofence attendance" bulk view
- Bulk payroll generation (loop all active employees)
- Visit edit page (currently read-only after creation)
- Charts: attendance ratio bar (in-progress), payroll trend across months

### P2
- Email payslip to employee (Resend / SendGrid)
- CSV exports for payroll, attendance, ledger
- PWA install support
- Push notifications (web push) for attendance reminders
- Geofencing for visits (currently exempt)

## Deployment
- Push repo to GitHub → Vercel imports → set 3 env vars (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_SUPABASE_BUCKET=sankalp-files`)
- Run migrations 001 → 002 → 003 in Supabase SQL Editor
