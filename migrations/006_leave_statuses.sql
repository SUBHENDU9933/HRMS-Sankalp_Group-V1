-- ============================================================================
-- Migration 006 — Leave statuses + auto-timing
-- Adds paid_leave / non_paid_leave / late statuses and updates live_salary.
-- ============================================================================

-- Allow new statuses on attendance
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.attendance'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', c); END IF;
END $$;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_chk
  CHECK (status IN ('present','late','half_day','absent','leave','paid_leave','non_paid_leave'));

-- Recreate live_salary so paid_leave & late count as paid days, non_paid_leave/leave/absent are unpaid.
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
  v_present float := 0; v_half float := 0; v_absent float := 0;
  v_advance float := 0; v_allowance float := 0; v_deduction float := 0;
  v_base    float := 0;
  v_paid    float := 0;
  v_net     float := 0;
  v_start date; v_end date;
BEGIN
  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end   := LEAST((v_start + interval '1 month')::date, (CURRENT_DATE + 1));

  SELECT
    COALESCE(SUM(CASE WHEN status IN ('present','late','paid_leave') THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status IN ('absent','non_paid_leave','leave') THEN 1 ELSE 0 END),0)
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
    AND entry_date >= v_start AND entry_date < v_end
    AND entry_type IN ('advance','allowance','deduction');

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM ledger
  WHERE employee_id = p_employee_id
    AND entry_type  = 'disbursement'
    AND paid_for_year = p_year AND paid_for_month = p_month;

  IF emp.salary_type = 'daily' THEN
    v_base := (v_present + 0.5 * v_half) * COALESCE(emp.daily_rate, 0);
  ELSIF COALESCE(emp.working_days, 26) > 0 THEN
    v_base := ((v_present + 0.5 * v_half) / emp.working_days) * COALESCE(emp.monthly_salary, 0);
  END IF;

  v_net := v_base + v_allowance - v_advance - v_deduction;

  RETURN QUERY
  SELECT v_present, v_half, v_absent,
    round(v_base::numeric, 2)::float, v_allowance, v_deduction, v_advance,
    round(v_net::numeric, 2)::float,
    round(v_paid::numeric, 2)::float,
    round((v_net - v_paid)::numeric, 2)::float;
END;
$$;
