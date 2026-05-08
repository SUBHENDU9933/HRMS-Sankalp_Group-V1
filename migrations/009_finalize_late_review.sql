-- ============================================================================
-- Migration 009 — Auto-finalize stale "under_review" absences.
-- After 8 PM IST on any given day, OR for any past date, any attendance row
-- where status='absent' AND under_review=true is finalised (under_review=false).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_late_review()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH ist_now AS (SELECT (now() AT TIME ZONE 'Asia/Kolkata') AS ts),
  upd AS (
    UPDATE attendance a
       SET under_review = false
     WHERE a.status = 'absent'
       AND a.under_review = true
       AND (
         a.date < ((SELECT (ts)::date FROM ist_now))
         OR (
           a.date = ((SELECT (ts)::date FROM ist_now))
           AND (SELECT (ts)::time FROM ist_now) >= time '20:00:00'
         )
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_late_review() TO authenticated;
