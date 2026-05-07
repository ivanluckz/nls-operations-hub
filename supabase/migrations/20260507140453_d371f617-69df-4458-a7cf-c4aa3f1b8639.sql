
-- Restore EXECUTE on trigger helper functions. Postgres requires the invoking
-- role to hold EXECUTE on the trigger function, even though it's SECURITY DEFINER.
-- These return `trigger` and are NOT exposed by PostgREST as RPCs.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_email_domain() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_attendance_notification() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_activity_enrollment() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_student_profile_required() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_workout_signup_cooldown() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_workout_capacity() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_medical_visit_to_workout() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_theme_like_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_direct_message() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_self_dev_badge() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_attendance_streak() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_dev_badge_insert() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO anon, authenticated;
