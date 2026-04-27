# Sankalp Interior Solution — HRMS

> Hybrid HRMS + Attendance + Payroll + Field Visit Verification.
> Tagline: **ঘর নয়, স্বপ্ন সাজাই আমরা**

## Stack
- **Backend**: FastAPI + SQLAlchemy (async) + Supabase Postgres (Transaction Pooler)
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Auth**: Custom JWT (bcrypt + HS256)
- **Storage**: Supabase Storage (bucket: `sankalp-files`, public)
- **PDF**: Server-side ReportLab (payslips)

## Modules
- Dashboard (admin / employee variants)
- Field Visits (Lead / Project) with selfie + GPS proof + watermark
- Attendance (selfie + GPS + watermark)
- Employees (admin CRUD, role: admin/manager/employee)
- Payroll (auto from attendance + ledger; payslip PDF)
- Ledger / Khata (advance / allowance / deduction)
- Expenses (filterable)
- Profile (self-service)

## First-time Setup

1. **Configure env** — copy `.env` and set:
   ```
   DATABASE_URL=postgresql://postgres.<project>:<password>@aws-…pooler.supabase.com:6543/postgres
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=...
   JWT_SECRET=...
   SEED_ADMIN_EMAIL=admin@yourco.com
   SEED_ADMIN_PASSWORD=...
   SEED_ADMIN_NAME=Admin
   ```
2. **Run migration** — open Supabase Dashboard → SQL Editor → paste `migrations/001_initial.sql` → Run.
   (Or run `python backend/apply_migration.py` once locally.)
3. **Storage bucket** — backend auto-creates `sankalp-files` (public) on startup using the service key.
4. **Start services** — supervisor (preview env) handles this. Locally:
   ```
   cd backend && uvicorn server:app --host 0.0.0.0 --port 8001
   cd frontend && yarn install && yarn start
   ```
5. **Login** — use the seeded admin from `.env`.

## Default Admin
See `/app/memory/test_credentials.md`.

## Deployment
- **Frontend (Vercel)**: import repo → set `REACT_APP_BACKEND_URL` → deploy.
- **Backend**: deploy FastAPI to Railway/Render/Fly. Required envs: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `SEED_ADMIN_*`.
- After backend is up, point frontend `REACT_APP_BACKEND_URL` to it.

## API
All routes are prefixed with `/api`. See `backend/server.py` for the full surface.

## Notes
- All file uploads (selfies, site photos, floor plans, profile photos, receipts) flow through `POST /api/upload` (data URL) and land in Supabase Storage as public URLs.
- Watermark is rendered client-side on canvas before upload.
- RLS is **disabled** on all tables — auth is enforced at the FastAPI layer with custom JWT.
