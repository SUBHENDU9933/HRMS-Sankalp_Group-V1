-- ============================================================================
-- Migration 008 — Restrict employee self-update to safe fields only.
-- Admins keep full update power; everyone else can only modify their own
-- name / phone / address / photo / bank / password.
-- Job-info (role, designation, department, employee_code, joining_date, status)
-- and salary (salary_type, daily_rate, monthly_salary, working_days,
-- paid_leaves_per_month) become admin-only via a row-level trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.employees_block_protected_updates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admins are allowed to change anything.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin: only their OWN row, only safe fields.
  IF NEW.id <> public.my_employee_id() THEN
    RAISE EXCEPTION 'Only admins can edit other employees';
  END IF;

  IF NEW.role             IS DISTINCT FROM OLD.role
  OR NEW.employee_code    IS DISTINCT FROM OLD.employee_code
  OR NEW.designation      IS DISTINCT FROM OLD.designation
  OR NEW.department       IS DISTINCT FROM OLD.department
  OR NEW.joining_date     IS DISTINCT FROM OLD.joining_date
  OR NEW.status           IS DISTINCT FROM OLD.status
  OR NEW.salary_type      IS DISTINCT FROM OLD.salary_type
  OR NEW.daily_rate       IS DISTINCT FROM OLD.daily_rate
  OR NEW.monthly_salary   IS DISTINCT FROM OLD.monthly_salary
  OR NEW.working_days     IS DISTINCT FROM OLD.working_days
  OR NEW.paid_leaves_per_month IS DISTINCT FROM OLD.paid_leaves_per_month
  THEN
    RAISE EXCEPTION 'Job info and salary fields can only be changed by an admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_protect ON public.employees;
CREATE TRIGGER trg_employees_protect
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_block_protected_updates();
