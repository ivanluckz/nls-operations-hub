REVOKE EXECUTE ON FUNCTION public.get_workout_signup_students(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workout_signup_students(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workout_signup_students(uuid[]) TO authenticated;