CREATE UNIQUE INDEX IF NOT EXISTS workout_signups_one_per_student
  ON public.workout_signups(student_id);

CREATE OR REPLACE FUNCTION public.enforce_student_profile_required()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'student'
  ) THEN
    RETURN NEW;
  END IF;

  IF OLD.house_id IS NOT NULL AND NEW.house_id IS NULL THEN
    RAISE EXCEPTION 'House is required and cannot be cleared.';
  END IF;

  IF OLD.mentor_id IS NOT NULL AND NEW.mentor_id IS NULL THEN
    RAISE EXCEPTION 'Mentor teacher is required and cannot be cleared.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_profile_required_trg ON public.profiles;
CREATE TRIGGER enforce_student_profile_required_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_profile_required();