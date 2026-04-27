# Sankalp Interior Solution — HRMS PRD

## Original Problem Statement
Build a hybrid HRMS for Sankalp Interior Solution (Sankalp Group & Business Solution) — combining Employee Management, Attendance (selfie + GPS + watermark), Payroll (daily/monthly + incentives + deductions + payslip PDF), Field Visit Verification (Lead/Project visits with selfie+GPS proof, site photos, floor plan, requirement sheet), Ledger (Khata), and Expenses. 3 roles: Admin/HR, Manager, Employee. Tagline (Bengali): "ঘর নয়, স্বপ্ন সাজাই আমরা".

## Architecture
- **Backend**: FastAPI (async) + SQLAlchemy + Supabase Postgres (Transaction Pooler) + Supabase Storage (public bucket `sankalp-files`)
- **Frontend**: React 19 + Tailwind + Shadcn UI; client-side selfie watermarking via canvas
- **Auth**: Custom JWT (HS256) with bcrypt; role guard at FastAPI layer (RLS disabled)
- **PDF**: ReportLab payslips, branded with Sankalp blue/orange

## User Personas
- **Admin/HR (Subhendu)**: Manages all employees, payroll, expenses, ledger; sees company-wide dashboard.
- **Manager**: Approves/edits attendance and visits; can add expenses; cannot delete employees.
- **Employee**: Marks own attendance, logs own field visits, views own salary/payslip & ledger balance.

## Core Requirements (delivered Feb 2026)
- ✅ Login / Logout with JWT
- ✅ Employees CRUD (admin) + self-update profile (everyone)
- ✅ Attendance with selfie + GPS + watermark + admin override
- ✅ Field Visits (Lead + Project) with selfie/GPS proof, site photos, floor plan, requirement sheet
- ✅ Payroll generation auto-pulling attendance breakdown + ledger deductions; manual incentive/bonus/overtime
- ✅ Payslip PDF download
- ✅ Ledger / Khata with running balance
- ✅ Expenses with category + date filters
- ✅ Role-aware Dashboard (admin KPIs vs employee personal)
- ✅ Mobile-first UX (bottom nav + FAB) and desktop sidebar
- ✅ Bengali tagline + Manrope/IBM Plex Sans typography

## What's been implemented (2026-02)
- Backend: 30+ API endpoints, all role-gated, tested 26/27 passing
- Frontend: 11 pages (Login, Dashboard, FieldVisits, AddVisit, VisitDetail, AttendancePage, Employees, EmployeeForm, Payroll, Ledger, Expenses, Profile)
- Schema migration via /app/migrations/001_initial.sql + apply_migration.py (already executed on Supabase)
- Storage bucket auto-created on backend startup
- Default admin seeded from .env

## Backlog (P0/P1/P2)
### P1
- Employee documents upload (separate from photo) — stub exists in model
- Visit edit form (currently read-only after creation; admin delete works)
- Payroll bulk-generate (loop all active employees in one click)
- Mobile gestures: pull-to-refresh on lists

### P2
- Charts on dashboard (visits trend, expense breakdown) using recharts
- Employee performance scoring (visits/month, attendance %)
- Export: payroll CSV, attendance CSV
- Email payslip to employee
- Geofencing alerts (visit selfie outside expected radius)

## Next Tasks (suggested)
1. Implement bulk payroll generation
2. Add visit edit page
3. Add CSV exports for payroll/attendance
4. Add basic charts (recharts) to admin dashboard
