-- ============================================================================
-- Migration 004 — allow employees to self-generate payroll for their own id
-- ============================================================================

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
  -- ▼ allow admin OR the employee themself
  IF NOT (public.is_admin() OR p_employee_id = public.my_employee_id()) THEN
    RAISE EXCEPTION 'Only admins can generate payroll for other employees';
  END IF;

  SELECT * INTO emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;

  SELECT
    COALESCE(SUM(CASE WHEN status='present'  THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status='absent'   THEN 1 ELSE 0 END),0)
  INTO v_present, v_half, v_absent
  FROM attendance
  WHERE employee_id = p_employee_id
    AND date >= v_start AND date < v_end
    AND COALESCE(under_review, false) = false;

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

-- Allow self-insert for payroll so employees can generate their own row via RPC bypass
-- (RPC is SECURITY DEFINER, so RLS is bypassed already; this is just a safety net)
DROP POLICY IF EXISTS pay_ins ON payroll;
CREATE POLICY pay_ins ON payroll FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.my_employee_id());
