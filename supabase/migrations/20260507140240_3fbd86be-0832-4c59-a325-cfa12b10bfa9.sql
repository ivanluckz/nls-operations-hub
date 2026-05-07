
-- These are trigger/helper functions never meant to be called via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.validate_email_domain() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_attendance_notification() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_activity_enrollment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_student_profile_required() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_signup_cooldown() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_capacity() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_medical_visit_to_workout() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_theme_like_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_direct_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_self_dev_badge() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_attendance_streak() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.block_dev_badge_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, public;
