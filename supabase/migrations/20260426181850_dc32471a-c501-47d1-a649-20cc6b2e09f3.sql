-- Enforce 100-day cooldown before students can leave a workout signup.
-- Admins and moderators bypass the cooldown.
CREATE OR REPLACE FUNCTION public.enforce_workout_signup_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_elapsed integer;
BEGIN
  -- Allow admins and moderators to bypass
  IF public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()) THEN
    RETURN OLD;
  END IF;

  -- Only enforce for the student themselves
  IF auth.uid() = OLD.student_id THEN
    v_days_elapsed := EXTRACT(DAY FROM (now() - OLD.created_at))::int;
    IF v_days_elapsed < 100 THEN
      RAISE EXCEPTION 'You can only leave or change this workout after 100 days. % day(s) remaining.', (100 - v_days_elapsed);
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS workout_signup_cooldown ON public.workout_signups;
CREATE TRIGGER workout_signup_cooldown
BEFORE DELETE ON public.workout_signups
FOR EACH ROW
EXECUTE FUNCTION public.enforce_workout_signup_cooldown();