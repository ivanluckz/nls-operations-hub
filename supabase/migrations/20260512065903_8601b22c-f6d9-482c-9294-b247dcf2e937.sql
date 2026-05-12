
-- 1) Allocations: drop email-LIKE branch; teachers can only see allocations for activities they own.
DROP POLICY IF EXISTS "Teachers can view allocations for their activities" ON public.allocations;
CREATE POLICY "Teachers can view allocations for their activities"
ON public.allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = allocations.activity_id
      AND a.teacher_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- 2) message_reactions: restrict INSERT to activity participants (teacher or enrolled student) and admins/moderators.
DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_admin(auth.uid())
    OR public.is_moderator(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.activity_messages m
      JOIN public.activities a ON a.id = m.activity_id
      WHERE m.id = message_reactions.message_id
        AND (
          a.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.allocations al
            WHERE al.activity_id = a.id AND al.student_id = auth.uid()
          )
        )
    )
  )
);

-- 3) Revoke EXECUTE from anon on all SECURITY DEFINER functions; revoke from authenticated on trigger-only functions.
-- Trigger-only functions (no caller should invoke directly):
REVOKE EXECUTE ON FUNCTION public.create_attendance_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_student_profile_required() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_capacity() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_signup_cooldown() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_direct_message() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_dev_badge() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_medical_visit_to_workout() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_theme_like_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_activity_enrollment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_attendance_streak() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_email_domain() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_dev_badge_insert() FROM anon, authenticated, PUBLIC;

-- App-level RPC helpers: only authenticated callers; deny anon.
REVOKE EXECUTE ON FUNCTION public.bump_theme_install_count(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_call(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_allocated_students() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_email(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profile_emails(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_students(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workout_signup_students(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_medical(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_rl_coach(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_users_for_dm(text) FROM anon, PUBLIC;
