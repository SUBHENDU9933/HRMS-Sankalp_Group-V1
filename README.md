# Sankalp Interior Solution — HRMS

> Hybrid HRMS + Attendance + Payroll + Field Visit Verification.
> Tagline: **ঘর নয়, স্বপ্ন সাজাই আমরা**

A **fully Supabase-powered** web application — no separate backend server required.
The React frontend talks directly to Supabase (Auth + Postgres + Storage) and is
deployed to Vercel as a static SPA.

---

## Architecture

```
        ┌──────────────────────────┐
        │  React 19 SPA (Vercel)   │
        │  Tailwind + Shadcn UI    │
        └─────────────┬────────────┘
                      │ @supabase/supabase-js
                      ▼
        ┌──────────────────────────┐
        │       Supabase           │
        │  Auth · Postgres (RLS)   │
        │  Storage (public bucket) │
        └──────────────────────────┘
```

- **Auth**: Supabase Auth (email + password)
- **DB**: Postgres + Row Level Security (`migrations/002_supabase_only.sql`)
- **Storage**: Public bucket `sankalp-files` (selfies, photos, floor plans, receipts)
- **PDF**: Client-side via `jspdf` + `jspdf-autotable`

## Modules
- Dashboard (admin / manager / employee variants)
- Field Visits — Lead / Project, with selfie + GPS proof + watermark
- Attendance — selfie + GPS + watermark
- Employees — admin CRUD, role: admin / manager / employee
- Payroll — auto from attendance + ledger; client-side payslip PDF
- Ledger / Khata — advance / allowance / deduction with running balance
- Expenses — filterable by category + date
- Profile — self-service edits

---

## Folder layout

```
/migrations
  001_initial.sql          ← creates tables
  002_supabase_only.sql    ← RLS, helper fns, RPCs (run AFTER 001)
/frontend                  ← Vercel "Root Directory" must be set to this
  src/
    lib/                   ← supabase client, auth context, data layer, pdf
    pages/                 ← all routes
    components/            ← Layout, SelfieCapture, ui/*
  vercel.json
  .env.example
/backend                   ← LEGACY — no longer used. Safe to delete on GitHub.
```

---

## 1) Supabase setup (one-time)

1. Create a project at https://supabase.com.
2. **SQL Editor → New query**, run **`migrations/001_initial.sql`** then
   **`migrations/002_supabase_only.sql`**.
3. **Authentication → Providers → Email** → disable "Confirm email".
4. **Authentication → Users → Add user**:
   - Email: `info.subhendu@gmail.com` (or your admin email)
   - Password: choose a strong one
   - Auto-confirm: **ON**
   The email **must** match an `employees` row whose `role = 'admin'`.
5. **Storage** — bucket `sankalp-files` is created by the migration (public).
6. From **Settings → API**, copy:
   - `Project URL`  → `REACT_APP_SUPABASE_URL`
   - `anon public key` → `REACT_APP_SUPABASE_ANON_KEY`

---

## 2) GitHub setup

1. In Emergent chat, click **Save to GitHub** to push this repo.
2. Optional: delete `/backend` and `/tests` from the GitHub repo — the app no longer
   uses the FastAPI server.

---

## 3) Vercel deployment

1. **New Project → Import** the GitHub repo.
2. **Root Directory** → `frontend`
3. **Framework preset** → Create React App (auto-detected).
4. **Environment Variables**:
   | Key | Value |
   |---|---|
   | `REACT_APP_SUPABASE_URL` | `https://<project>.supabase.co` |
   | `REACT_APP_SUPABASE_ANON_KEY` | `sb_publishable_…` (anon key) |
   | `REACT_APP_SUPABASE_BUCKET` | `sankalp-files` |
5. **Deploy**. The included `vercel.json` already pins `yarn` and runs `CI=false yarn build`.

---

## Local development

```bash
cd frontend
cp .env.example .env          # fill the three SUPABASE vars
yarn install
yarn start                    # http://localhost:3000
```

---

## Default admin
`info.subhendu@gmail.com` / `Subhendu8958@` (created in Supabase Auth in step 1.4).

## Notes
- All file uploads go directly to Supabase Storage from the browser using the anon
  key + RLS policies (`sankalp_upload`). Watermark is rendered on canvas before upload.
- All data access is gated by Postgres RLS. Admin/manager helpers are SQL functions
  (`is_admin`, `is_manager_or_admin`).
- `generate_payroll` and `create_employee_row` are `SECURITY DEFINER` RPCs — only
  admins can invoke them.
