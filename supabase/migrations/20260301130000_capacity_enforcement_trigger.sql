-- Capacity enforcement trigger
-- Blocks any INSERT on allocations that would exceed the activity's capacity.
-- Bypasses the check for service_role (used by auto-allocation edge function and
-- bulk import functions that manage their own capacity logic).

CREATE OR REPLACE FUNCTION check_activity_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity INTEGER;
  v_enrolled INTEGER;
  v_jwt_role TEXT;
BEGIN
  -- service_role bypasses this check (auto-allocation, bulk imports)
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := NULL;
  END;

  IF v_jwt_role IS NULL OR v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get activity capacity
  SELECT capacity INTO v_capacity
  FROM public.activities
  WHERE id = NEW.activity_id;

  -- Activity not found — let the FK constraint handle it
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing allocations for this activity on this day slot
  SELECT COUNT(*) INTO v_enrolled
  FROM public.allocations
  WHERE activity_id = NEW.activity_id
    AND day_of_week = NEW.day_of_week;

  IF v_enrolled >= v_capacity THEN
    RAISE EXCEPTION 'Activity is at full capacity (% / %)', v_enrolled, v_capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_activity_capacity ON public.allocations;
CREATE TRIGGER enforce_activity_capacity
  BEFORE INSERT ON public.allocations
  FOR EACH ROW EXECUTE FUNCTION check_activity_capacity();
