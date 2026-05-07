-- ============================================================================
-- Sankalp HRMS — Migration 003: Company Settings + Geofence + Live Payroll
-- Run AFTER 001_initial.sql and 002_supabase_only.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_settings  (singleton: id = 'default')
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  name            VARCHAR(150) NOT NULL DEFAULT 'Sankalp Interior Solution',
  tagline         TEXT DEFAULT 'ঘর নয়, স্বপ্ন সাজাই আমরা',
  logo_url        TEXT,
  email           VARCHAR(150),
  phone           VARCHAR(30),
  website         VARCHAR(200),
  address         TEXT,
  -- Office geofence
  office_lat        DOUBLE PRECISION DEFAULT 22.6179464,
  office_lng        DOUBLE PRECISION DEFAULT 88.4343189,
  office_radius_m   INTEGER DEFAULT 100,
  -- Timing rules
  office_in_time    TIME DEFAULT '09:30:00',
  office_out_time   TIME DEFAULT '18:30:00',
  late_after_min    INTEGER DEFAULT 15,
  half_day_after_min INTEGER DEFAULT 120,
  absent_after_min  INTEGER DEFAULT 240,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO company_settings(id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Extend attendance: type / visit / label / geofence audit
-- ----------------------------------------------------------------------------
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_type VARCHAR(20) DEFAULT 'office'; -- office | field_visit | project_visit
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS visit_id        TEXT REFERENCES visits(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_label  TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS distance_m      DOUBLE PRECISION;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS under_review    BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_att_review ON attendance(under_review) WHERE under_review = true;

-- ----------------------------------------------------------------------------
-- 3. Ledger: optional `category` column (bonus / incentive / extra_day / etc.)
-- ----------------------------------------------------------------------------
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS category VARCHAR(40);

-- ----------------------------------------------------------------------------
-- 4. live_salary(employee_id, year, month) — running net till today
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_salary(p_employee_id text, p_year int, p_month int)
RETURNS TABLE (
  present_days  float,
  half_days     float,
  absent_days   float,
  base_salary   float,
  allowance     float,
  deductions    float,
  advance       float,
  net_live      float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp employees%ROWTYPE;
  v_present float := 0; v_half float := 0; v_absent float := 0;
  v_advance float := 0; v_allowance float := 0; v_deduction float := 0;
  v_base    float := 0;
  v_start date; v_end date;
BEGIN
  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_start := make_date(p_year, p_month, 1);
  -- Cap at end-of-month OR today+1 (whichever earlier) so it stays "live till today"
  v_end := LEAST((v_start + interval '1 month')::date, (CURRENT_DATE + 1));

  SELECT
    COALESCE(SUM(CASE WHEN status='present'  THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='absent'   THEN 1 ELSE 0 END),0)
  INTO v_present, v_half, v_absent
  FROM attendance
  WHERE employee_id = p_employee_id
    AND date >= v_start AND date < v_end
    AND COALESCE(under_review,false) = false;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),   0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'), 0)
  INTO v_advance, v_allowance, v_deduction
  FROM ledger
  WHERE employee_id = p_employee_id
    AND entry_date >= v_start AND entry_date < v_end;

  IF emp.salary_type = 'daily' THEN
    v_base := (v_present + 0.5 * v_half) * COALESCE(emp.daily_rate, 0);
  ELSIF COALESCE(emp.working_days, 26) > 0 THEN
    v_base := ((v_present + 0.5 * v_half) / emp.working_days) * COALESCE(emp.monthly_salary, 0);
  END IF;

  RETURN QUERY
  SELECT
    v_present, v_half, v_absent,
    round(v_base::numeric, 2)::float,
    v_allowance,
    v_deduction,
    v_advance,
    round((v_base + v_allowance - v_advance - v_deduction)::numeric, 2)::float;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. live_payroll_total(year, month) — admin aggregate across all active emps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.live_payroll_total(p_year int, p_month int)
RETURNS TABLE (
  employee_count   int,
  total_base       float,
  total_allowance  float,
  total_advance    float,
  total_deductions float,
  total_net        float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(s.base_salary), 0)::float,
    COALESCE(SUM(s.allowance),   0)::float,
    COALESCE(SUM(s.advance),     0)::float,
    COALESCE(SUM(s.deductions),  0)::float,
    COALESCE(SUM(s.net_live),    0)::float
  FROM employees e
  CROSS JOIN LATERAL public.live_salary(e.id, p_year, p_month) AS s
  WHERE e.status = 'active';
$$;

-- ----------------------------------------------------------------------------
-- 6. company_settings RLS — everyone reads, only admin writes
-- ----------------------------------------------------------------------------
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='company_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_settings', r.policyname); END LOOP;
END $$;

CREATE POLICY cs_sel ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY cs_ins ON company_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY cs_upd ON company_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- DONE.
-- Defaults pre-filled with Sankalp Interior Solution office (Kolkata):
--   Lat 22.6179464, Lng 88.4343189, Radius 100m.
-- Edit anytime from Admin → Settings page.
-- ============================================================================
