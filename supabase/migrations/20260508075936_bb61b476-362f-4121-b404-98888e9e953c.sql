CREATE OR REPLACE FUNCTION public.get_workout_signup_students(_workout_ids uuid[])
RETURNS TABLE(
  signup_id uuid,
  workout_id uuid,
  student_id uuid,
  full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ws.id AS signup_id,
    ws.workout_id,
    ws.student_id,
    p.full_name
  FROM public.workout_signups ws
  JOIN public.profiles p ON p.id = ws.student_id
  WHERE ws.workout_id = ANY(_workout_ids)
    AND p.banned = false
    AND (
      public.is_admin(auth.uid())
      OR public.is_moderator(auth.uid())
      OR public.is_rl_coach(auth.uid())
      OR public.is_medical(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.workout_teachers wt
        WHERE wt.workout_id = ws.workout_id
          AND wt.teacher_id = auth.uid()
      )
    )
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_workout_signup_students(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workout_signup_students(uuid[]) TO authenticated;