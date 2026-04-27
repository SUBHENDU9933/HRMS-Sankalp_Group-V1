-- ============================================================================
-- Sankalp HRMS — Supabase Initial Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- Required extension for gen_random_uuid (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- employees (also acts as the auth/users table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(150) NOT NULL,
  phone           VARCHAR(30),
  role            VARCHAR(20) NOT NULL DEFAULT 'employee',  -- admin/manager/employee
  employee_code   VARCHAR(50) UNIQUE,
  designation     VARCHAR(100),
  department      VARCHAR(100),
  joining_date    DATE,
  salary_type     VARCHAR(20) DEFAULT 'monthly',            -- daily/monthly
  daily_rate      DOUBLE PRECISION DEFAULT 0,
  monthly_salary  DOUBLE PRECISION DEFAULT 0,
  working_days    INTEGER DEFAULT 26,
  photo_url       TEXT,
  address         TEXT,
  bank_account    VARCHAR(50),
  bank_name       VARCHAR(100),
  bank_ifsc       VARCHAR(20),
  documents       JSONB DEFAULT '[]'::jsonb,
  status          VARCHAR(20) DEFAULT 'active',             -- active/inactive
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ----------------------------------------------------------------------------
-- attendance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id       TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  status            VARCHAR(20) NOT NULL,                   -- present/absent/half_day
  check_in_time     TIMESTAMPTZ,
  selfie_url        TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  location_address  TEXT,
  notes             TEXT,
  marked_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_att_emp ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_att_emp_date ON attendance(employee_id, date);

-- ----------------------------------------------------------------------------
-- visits
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id           TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  visit_type            VARCHAR(20) NOT NULL,               -- lead/project
  visit_date            TIMESTAMPTZ DEFAULT NOW(),
  lead_name             VARCHAR(200),
  lead_phone            VARCHAR(30),
  lead_location         TEXT,
  customer_requirement  TEXT,
  budget                VARCHAR(100),
  measurement_details   TEXT,
  requirement_sheet     TEXT,
  project_name          VARCHAR(200),
  project_location      TEXT,
  project_status        VARCHAR(30),                        -- site_check/in_progress/inspection/completed
  notes                 TEXT,
  selfie_url            TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location_address      TEXT,
  site_photos           JSONB DEFAULT '[]'::jsonb,
  floor_plan_url        TEXT,
  documents             JSONB DEFAULT '[]'::jsonb,
  status                VARCHAR(20) DEFAULT 'completed',    -- completed/follow_up
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_emp ON visits(employee_id);
CREATE INDEX IF NOT EXISTS idx_visits_type ON visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

-- ----------------------------------------------------------------------------
-- payroll
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month         INTEGER NOT NULL,
  year          INTEGER NOT NULL,
  present_days  DOUBLE PRECISION DEFAULT 0,
  half_days     DOUBLE PRECISION DEFAULT 0,
  absent_days   DOUBLE PRECISION DEFAULT 0,
  base_salary   DOUBLE PRECISION DEFAULT 0,
  incentive     DOUBLE PRECISION DEFAULT 0,
  bonus         DOUBLE PRECISION DEFAULT 0,
  overtime      DOUBLE PRECISION DEFAULT 0,
  deductions    DOUBLE PRECISION DEFAULT 0,
  net_salary    DOUBLE PRECISION DEFAULT 0,
  notes         TEXT,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_emp ON payroll(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payroll_emp_month ON payroll(employee_id, month, year);

-- ----------------------------------------------------------------------------
-- ledger (Khata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_type   VARCHAR(20) NOT NULL,                       -- advance/allowance/deduction
  amount       DOUBLE PRECISION NOT NULL,
  description  TEXT,
  entry_date   DATE NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_emp ON ledger(employee_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger(entry_date);

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category      VARCHAR(80) NOT NULL,
  amount        DOUBLE PRECISION NOT NULL,
  description   TEXT,
  expense_date  DATE NOT NULL,
  paid_by       VARCHAR(150),
  receipt_url   TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exp_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(expense_date);

-- ----------------------------------------------------------------------------
-- Disable Row Level Security (auth handled at FastAPI layer with custom JWT)
-- ----------------------------------------------------------------------------
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DONE. Tables ready.
-- After running, also create a Storage bucket named "sankalp-files":
--   Supabase Dashboard → Storage → New Bucket → name: sankalp-files → Public: ON
-- (The backend will also try to auto-create it on startup with the service key.)
-- ============================================================================
