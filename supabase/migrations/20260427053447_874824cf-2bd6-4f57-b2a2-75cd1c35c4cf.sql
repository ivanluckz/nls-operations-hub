CREATE OR REPLACE FUNCTION public.enforce_workout_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_current_count integer;
BEGIN
  -- Admins/moderators bypass
  IF public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO v_capacity
  FROM public.workouts WHERE id = NEW.workout_id;

  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.workout_signups WHERE workout_id = NEW.workout_id;

  IF v_current_count >= v_capacity THEN
    RAISE EXCEPTION 'This workout is full (% / % spots taken).', v_current_count, v_capacity;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workout_capacity_trg ON public.workout_signups;
CREATE TRIGGER enforce_workout_capacity_trg
  BEFORE INSERT ON public.workout_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_workout_capacity();