-- ============================================================================
-- Sankalp HRMS — Migration 002: Supabase-only (RLS + functions + Auth link)
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run.
-- Assumes migration 001_initial.sql has already been applied.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auth helpers — look up the calling user's employees row by EMAIL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT LOWER(COALESCE(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM employees WHERE LOWER(email) = public.my_email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM employees WHERE LOWER(email) = public.my_email() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM employees
    WHERE LOWER(email) = public.my_email() AND role = 'admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM employees
    WHERE LOWER(email) = public.my_email() AND role IN ('admin','manager') AND status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop password_hash — Supabase Auth handles passwords now. Make it optional.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN password_hash SET DEFAULT 'supabase-auth';

-- ---------------------------------------------------------------------------
-- 3. Generate payroll as a SQL function (admin-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_payroll(
  p_employee_id text,
  p_month int,
  p_year int,
  p_incentive float DEFAULT 0,
  p_bonus float DEFAULT 0,
  p_overtime float DEFAULT 0,
  p_extra_deductions float DEFAULT 0,
  p_notes text DEFAULT NULL
) RETURNS payroll
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp employees%ROWTYPE;
  v_present float := 0;
  v_half float := 0;
  v_absent float := 0;
  v_ledger float := 0;
  v_base float := 0;
  v_deductions float := 0;
  v_net float := 0;
  v_start date;
  v_end date;
  result payroll;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate payroll';
  END IF;

  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;

  SELECT
    COALESCE(SUM(CASE WHEN status='present' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END),0)
  INTO v_present, v_half, v_absent
  FROM attendance
  WHERE employee_id = p_employee_id AND date >= v_start AND date < v_end;

  SELECT COALESCE(SUM(amount),0) INTO v_ledger
  FROM ledger
  WHERE employee_id = p_employee_id AND entry_date >= v_start AND entry_date < v_end
    AND entry_type IN ('advance','deduction');

  IF emp.salary_type = 'daily' THEN
    v_base := (v_present + 0.5 * v_half) * COALESCE(emp.daily_rate, 0);
  ELSIF COALESCE(emp.working_days, 26) > 0 THEN
    v_base := ((v_present + 0.5 * v_half) / emp.working_days) * COALESCE(emp.monthly_salary, 0);
  END IF;

  v_deductions := v_ledger + COALESCE(p_extra_deductions, 0);
  v_net := v_base + COALESCE(p_incentive,0) + COALESCE(p_bonus,0) + COALESCE(p_overtime,0) - v_deductions;

  INSERT INTO payroll(
    employee_id, month, year, present_days, half_days, absent_days,
    base_salary, incentive, bonus, overtime, deductions, net_salary, notes, generated_at
  ) VALUES (
    p_employee_id, p_month, p_year, v_present, v_half, v_absent,
    round(v_base::numeric, 2), COALESCE(p_incentive,0), COALESCE(p_bonus,0), COALESCE(p_overtime,0),
    round(v_deductions::numeric, 2), round(v_net::numeric, 2), p_notes, now()
  )
  ON CONFLICT (employee_id, month, year) DO UPDATE SET
    present_days = EXCLUDED.present_days,
    half_days    = EXCLUDED.half_days,
    absent_days  = EXCLUDED.absent_days,
    base_salary  = EXCLUDED.base_salary,
    incentive    = EXCLUDED.incentive,
    bonus        = EXCLUDED.bonus,
    overtime     = EXCLUDED.overtime,
    deductions   = EXCLUDED.deductions,
    net_salary   = EXCLUDED.net_salary,
    notes        = EXCLUDED.notes,
    generated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ledger balance function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ledger_balance(p_employee_id text)
RETURNS TABLE(advance float, allowance float, deduction float, balance float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sums AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),0) AS advance,
      COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'),0) AS allowance,
      COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'),0) AS deduction
    FROM ledger WHERE employee_id = p_employee_id
  )
  SELECT advance, allowance, deduction,
         round((advance + deduction - allowance)::numeric, 2)::float AS balance FROM sums;
$$;

-- ---------------------------------------------------------------------------
-- 5. Admin-only employee creation (creates auth user + employees row in one call)
--    Uses Supabase's auth.admin API via SECURITY DEFINER — only callable by admin.
--    Since we cannot call auth API from SQL, admin will still use supabase-js
--    admin.createUser() on the client (with ANON key it won't work) — INSTEAD
--    we expose a helper that inserts employees row given an existing auth user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_employee_row(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'employee',
  p_employee_code text DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_joining_date date DEFAULT NULL,
  p_salary_type text DEFAULT 'monthly',
  p_daily_rate float DEFAULT 0,
  p_monthly_salary float DEFAULT 0,
  p_working_days int DEFAULT 26,
  p_photo_url text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_bank_ifsc text DEFAULT NULL
) RETURNS employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result employees;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create employees';
  END IF;

  INSERT INTO employees(
    email, password_hash, name, phone, role, employee_code, designation, department,
    joining_date, salary_type, daily_rate, monthly_salary, working_days,
    photo_url, address, bank_account, bank_name, bank_ifsc, status
  ) VALUES (
    LOWER(p_email), 'supabase-auth', p_name, p_phone, p_role, p_employee_code, p_designation, p_department,
    p_joining_date, p_salary_type, p_daily_rate, p_monthly_salary, p_working_days,
    p_photo_url, p_address, p_bank_account, p_bank_name, p_bank_ifsc, 'active'
  )
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Enable RLS + policies
-- ---------------------------------------------------------------------------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('employees','attendance','visits','payroll','ledger','expenses')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename); END LOOP;
END $$;

-- Employees
CREATE POLICY emp_sel ON employees FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR LOWER(email) = public.my_email());
CREATE POLICY emp_ins ON employees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY emp_upd ON employees FOR UPDATE TO authenticated
  USING (public.is_admin() OR LOWER(email) = public.my_email())
  WITH CHECK (public.is_admin() OR LOWER(email) = public.my_email());
CREATE POLICY emp_del ON employees FOR DELETE TO authenticated
  USING (public.is_admin() AND LOWER(email) <> public.my_email());

-- Attendance
CREATE POLICY att_sel ON attendance FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY att_ins ON attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY att_upd ON attendance FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id())
  WITH CHECK (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY att_del ON attendance FOR DELETE TO authenticated
  USING (public.is_admin());

-- Visits
CREATE POLICY vis_sel ON visits FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY vis_ins ON visits FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());
CREATE POLICY vis_upd ON visits FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id())
  WITH CHECK (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY vis_del ON visits FOR DELETE TO authenticated
  USING (public.is_admin());

-- Payroll
CREATE POLICY pay_sel ON payroll FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY pay_ins ON payroll FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY pay_upd ON payroll FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY pay_del ON payroll FOR DELETE TO authenticated
  USING (public.is_admin());

-- Ledger
CREATE POLICY led_sel ON ledger FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR employee_id = public.my_employee_id());
CREATE POLICY led_ins ON ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY led_upd ON ledger FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY led_del ON ledger FOR DELETE TO authenticated
  USING (public.is_admin());

-- Expenses
CREATE POLICY exp_sel ON expenses FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());
CREATE POLICY exp_ins ON expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin());
CREATE POLICY exp_upd ON expenses FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin()) WITH CHECK (public.is_manager_or_admin());
CREATE POLICY exp_del ON expenses FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Storage policies — allow authenticated uploads to sankalp-files bucket
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  -- read: public (bucket is already public)
  INSERT INTO storage.buckets(id, name, public) VALUES ('sankalp-files','sankalp-files', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND policyname LIKE 'sankalp_%'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname); END LOOP;
END $$;

CREATE POLICY sankalp_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sankalp-files');
CREATE POLICY sankalp_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sankalp-files') WITH CHECK (bucket_id = 'sankalp-files');
CREATE POLICY sankalp_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sankalp-files' AND public.is_admin());
CREATE POLICY sankalp_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'sankalp-files');

-- ============================================================================
-- DONE. Now:
-- 1. Supabase Dashboard → Authentication → Providers → Email → disable "Confirm email"
-- 2. Authentication → Users → Add user:
--      email: info.subhendu@gmail.com
--      password: Subhendu8958@
--      auto-confirm: ON
--    (This gives the existing admin row access. Email MUST match exactly.)
-- 3. Future employee creation from the app calls auth.signUp() + create_employee_row()
-- ============================================================================
