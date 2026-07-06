-- Migration 011: atomic daily cost cap check
--
-- Replaces the Worker-side "select every row created today, sum in JS,
-- compare" gate with a single SQL function so the aggregate and the
-- comparison happen in one database transaction.
--
-- Soft cap: this function checks atomically within a transaction but does
-- not reserve — concurrent calls within the same transaction window can
-- still collectively overshoot by one estimate_cents each. True reservation
-- would require a separate reservations table; this significantly reduces
-- the race window without adding schema complexity.
--
-- Run manually in Supabase.

CREATE OR REPLACE FUNCTION check_and_reserve_daily_cost(
  estimate_cents integer,
  cap_cents integer,
  day_start timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_total integer;
BEGIN
  SELECT COALESCE(SUM(cost_usd_cents), 0)
  INTO current_total
  FROM analyses
  WHERE created_at >= day_start
    AND status != 'failed';

  IF current_total + estimate_cents > cap_cents THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
