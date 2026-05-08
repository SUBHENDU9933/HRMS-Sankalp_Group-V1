-- ============================================================================
-- Migration 007 — Dynamic working days + monthly paid-leave entitlement
--
-- Rules:
--   * working_days for ANY month = total calendar days in that month (28/30/31)
--   * Each employee has paid_leaves_per_month (default 4)
--   * Calculation auto-credits absent days as paid up to the unused leave cap.
--     Effective paid days = present + late + 0.5*half + paid_leave + min(absent + non_paid_leave, remaining_cap)
--     where remaining_cap = max(0, paid_leaves_per_month - paid_leave_count)
--   * Daily wage employees: daily_rate × effective_paid_days (cap still applies)
-- ============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS paid_leaves_per_month INTEGER DEFAULT 4;

UPDATE public.employees SET paid_leaves_per_month = 4 WHERE paid_leaves_per_month IS NULL;

-- live_salary — uses days_in_month and applies leave cap
DROP FUNCTION IF EXISTS public.live_salary(text, int, int);
CREATE OR REPLACE FUNCTION public.live_salary(p_employee_id text, p_year int, p_month int)
RETURNS TABLE (
  present_days  float,
  half_days     float,
  absent_days   float,
  base_salary   float,
  allowance     float,
  deductions    float,
  advance       float,
  net_live      float,
  paid_amount   float,
  outstanding   float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp employees%ROWTYPE;
  v_present float := 0;
  v_late float := 0;
  v_half float := 0;
  v_absent float := 0;
  v_paid_leave float := 0;
  v_non_paid float := 0;
  v_cap int := 4;
  v_remaining_cap int := 0;
  v_auto_credit float := 0;
  v_effective_paid float := 0;
  v_days_in_month int := 30;
  v_advance float := 0;
  v_allowance float := 0;
  v_deduction float := 0;
  v_base    float := 0;
  v_paid    float := 0;
  v_net     float := 0;
  v_start date;
  v_end   date;
BEGIN
  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_start := make_date(p_year, p_month, 1);
  v_days_in_month := EXTRACT(DAY FROM (v_start + interval '1 month - 1 day'))::int;
  v_cap := COALESCE(emp.paid_leaves_per_month, 4);

  -- "Live till today" capping
  v_end := LEAST((v_start + interval '1 month')::date, (CURRENT_DATE + 1));

  SELECT
    COALESCE(SUM(CASE WHEN status='present'        THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='late'           THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day'       THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status IN ('absent','leave') THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='paid_leave'     THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='non_paid_leave' THEN 1 ELSE 0 END),0)
  INTO v_present, v_late, v_half, v_absent, v_paid_leave, v_non_paid
  FROM attendance
  WHERE employee_id = p_employee_id
    AND date >= v_start AND date < v_end
    AND COALESCE(under_review,false) = false;

  -- Auto-credit absences as paid up to remaining monthly leave cap
  v_remaining_cap := GREATEST(v_cap - v_paid_leave::int, 0);
  v_auto_credit := LEAST(v_absent::int, v_remaining_cap);

  v_effective_paid := v_present + v_late + 0.5 * v_half + v_paid_leave + v_auto_credit;

  -- ledger
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),   0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'), 0)
  INTO v_advance, v_allowance, v_deduction
  FROM ledger
  WHERE employee_id = p_employee_id
    AND entry_date >= v_start AND entry_date < v_end
    AND entry_type IN ('advance','allowance','deduction');

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM ledger
  WHERE employee_id = p_employee_id
    AND entry_type = 'disbursement'
    AND paid_for_year = p_year AND paid_for_month = p_month;

  IF emp.salary_type = 'daily' THEN
    v_base := v_effective_paid * COALESCE(emp.daily_rate, 0);
  ELSIF v_days_in_month > 0 THEN
    v_base := (v_effective_paid / v_days_in_month) * COALESCE(emp.monthly_salary, 0);
  END IF;

  v_net := v_base + v_allowance - v_advance - v_deduction;

  RETURN QUERY
  SELECT
    -- expose paid-equivalent days (incl. auto-credit) so dashboards reflect real "paid" count
    (v_present + v_late + v_paid_leave + v_auto_credit)::float AS present_days,
    v_half AS half_days,
    GREATEST(v_absent - v_auto_credit, 0)::float + v_non_paid AS absent_days,
    round(v_base::numeric, 2)::float,
    v_allowance, v_deduction, v_advance,
    round(v_net::numeric, 2)::float,
    round(v_paid::numeric, 2)::float,
    round((v_net - v_paid)::numeric, 2)::float;
END;
$$;

-- generate_payroll — same logic, full month (no live cap)
DROP FUNCTION IF EXISTS public.generate_payroll(text, int, int, float, float, float, float, text);
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
  v_late float := 0;
  v_half float := 0;
  v_absent float := 0;
  v_paid_leave float := 0;
  v_non_paid float := 0;
  v_cap int := 4;
  v_remaining_cap int := 0;
  v_auto_credit float := 0;
  v_effective_paid float := 0;
  v_days_in_month int := 30;
  v_ledger float := 0;
  v_base float := 0;
  v_deductions float := 0;
  v_net float := 0;
  v_start date; v_end date;
  result payroll;
BEGIN
  IF NOT (public.is_admin() OR p_employee_id = public.my_employee_id()) THEN
    RAISE EXCEPTION 'Only admins can generate payroll for other employees';
  END IF;

  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;
  v_days_in_month := EXTRACT(DAY FROM (v_start + interval '1 month - 1 day'))::int;
  v_cap := COALESCE(emp.paid_leaves_per_month, 4);

  SELECT
    COALESCE(SUM(CASE WHEN status='present'        THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='late'           THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day'       THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status IN ('absent','leave') THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='paid_leave'     THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='non_paid_leave' THEN 1 ELSE 0 END),0)
  INTO v_present, v_late, v_half, v_absent, v_paid_leave, v_non_paid
  FROM attendance
  WHERE employee_id = p_employee_id
    AND date >= v_start AND date < v_end
    AND COALESCE(under_review, false) = false;

  v_remaining_cap := GREATEST(v_cap - v_paid_leave::int, 0);
  v_auto_credit := LEAST(v_absent::int, v_remaining_cap);
  v_effective_paid := v_present + v_late + 0.5 * v_half + v_paid_leave + v_auto_credit;

  SELECT COALESCE(SUM(amount),0) INTO v_ledger
  FROM ledger
  WHERE employee_id = p_employee_id AND entry_date >= v_start AND entry_date < v_end
    AND entry_type IN ('advance','deduction');

  IF emp.salary_type = 'daily' THEN
    v_base := v_effective_paid * COALESCE(emp.daily_rate, 0);
  ELSIF v_days_in_month > 0 THEN
    v_base := (v_effective_paid / v_days_in_month) * COALESCE(emp.monthly_salary, 0);
  END IF;

  v_deductions := v_ledger + COALESCE(p_extra_deductions, 0);
  v_net := v_base + COALESCE(p_incentive,0) + COALESCE(p_bonus,0) + COALESCE(p_overtime,0) - v_deductions;

  INSERT INTO payroll(
    employee_id, month, year, present_days, half_days, absent_days,
    base_salary, incentive, bonus, overtime, deductions, net_salary, notes, generated_at
  ) VALUES (
    p_employee_id, p_month, p_year,
    -- store paid-equivalent and unpaid-after-credit so payslip reflects truth
    (v_present + v_late + v_paid_leave + v_auto_credit),
    v_half,
    GREATEST(v_absent - v_auto_credit, 0) + v_non_paid,
    round(v_base::numeric, 2),
    COALESCE(p_incentive,0), COALESCE(p_bonus,0), COALESCE(p_overtime,0),
    round(v_deductions::numeric, 2),
    round(v_net::numeric, 2),
    p_notes, now()
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
