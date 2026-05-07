-- ============================================================================
-- Migration 005 — Salary Disbursement support
-- Adds a 3rd ledger mode (disbursement) with payment mode + transfer ref.
-- live_salary now also returns paid_amount + outstanding so payroll/payslip
-- can show "Earned − Paid = Outstanding".
-- ============================================================================

-- 1. Allow 'disbursement' as a valid entry_type (drop & recreate constraint)
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'public.ledger'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%entry_type%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ledger DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.ledger
  ADD CONSTRAINT ledger_entry_type_chk
  CHECK (entry_type IN ('advance','allowance','deduction','disbursement'));

-- 2. New columns for disbursement specifics
ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS payment_mode   VARCHAR(20);   -- cash | upi | bank | cheque
ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS transfer_ref   VARCHAR(120);  -- UTR / cheque no / txn id
ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS paid_for_month INTEGER;       -- 1..12
ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS paid_for_year  INTEGER;
CREATE INDEX IF NOT EXISTS idx_ledger_paid_period
  ON public.ledger(employee_id, paid_for_year, paid_for_month)
  WHERE entry_type = 'disbursement';

-- 3. live_salary — add paid_amount + outstanding columns
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
    COALESCE(SUM(CASE WHEN status='present'  THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='absent'   THEN 1 ELSE 0 END),0)
  INTO v_present, v_half, v_absent
  FROM attendance
  WHERE employee_id = p_employee_id
    AND date >= v_start AND date < v_end
    AND COALESCE(under_review,false) = false;

  -- Credits / debits attributable to this period (non-disbursement)
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),   0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'), 0)
  INTO v_advance, v_allowance, v_deduction
  FROM ledger
  WHERE employee_id = p_employee_id
    AND entry_date >= v_start AND entry_date < v_end
    AND entry_type IN ('advance','allowance','deduction');

  -- Disbursements paid FOR this month (by paid_for_year/month tag)
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
  SELECT
    v_present, v_half, v_absent,
    round(v_base::numeric, 2)::float,
    v_allowance, v_deduction, v_advance,
    round(v_net::numeric, 2)::float,
    round(v_paid::numeric, 2)::float,
    round((v_net - v_paid)::numeric, 2)::float;
END;
$$;

-- 4. live_payroll_total — extend with paid + outstanding
DROP FUNCTION IF EXISTS public.live_payroll_total(int, int);
CREATE OR REPLACE FUNCTION public.live_payroll_total(p_year int, p_month int)
RETURNS TABLE (
  employee_count   int,
  total_base       float,
  total_allowance  float,
  total_advance    float,
  total_deductions float,
  total_net        float,
  total_paid       float,
  total_outstanding float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(s.base_salary), 0)::float,
    COALESCE(SUM(s.allowance),   0)::float,
    COALESCE(SUM(s.advance),     0)::float,
    COALESCE(SUM(s.deductions),  0)::float,
    COALESCE(SUM(s.net_live),    0)::float,
    COALESCE(SUM(s.paid_amount), 0)::float,
    COALESCE(SUM(s.outstanding), 0)::float
  FROM employees e
  CROSS JOIN LATERAL public.live_salary(e.id, p_year, p_month) AS s
  WHERE e.status = 'active';
$$;

-- 5. ledger_balance — also return paid_out
DROP FUNCTION IF EXISTS public.ledger_balance(text);
CREATE OR REPLACE FUNCTION public.ledger_balance(p_employee_id text)
RETURNS TABLE (advance float, allowance float, deduction float, disbursed float, balance float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),     0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'),   0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'),   0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='disbursement'),0),
    -- "balance owed by company to employee": allowance - advance - deduction - (disbursed adjusts when payroll closes)
    COALESCE(SUM(amount) FILTER (WHERE entry_type='advance'),     0) +
    COALESCE(SUM(amount) FILTER (WHERE entry_type='deduction'),   0) -
    COALESCE(SUM(amount) FILTER (WHERE entry_type='allowance'),   0)
  FROM ledger WHERE employee_id = p_employee_id;
$$;
