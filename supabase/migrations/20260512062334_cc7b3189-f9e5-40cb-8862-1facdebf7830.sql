-- 1. Realtime SELECT: drop loose LIKE match
DROP POLICY IF EXISTS "rt_select_authorized" ON realtime.messages;
CREATE POLICY "rt_select_authorized" ON realtime.messages
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_moderator(auth.uid())
  OR realtime.topic() = ('user:' || auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.dm_channels ch
    WHERE ('dm:' || ch.id::text) = realtime.topic()
      AND (ch.user1_id = auth.uid() OR ch.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.call_sessions cs
    WHERE ('call:' || cs.id::text) = realtime.topic()
      AND public.can_access_call(cs.id, auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.allocations al
    WHERE ('activity:' || al.activity_id::text) = realtime.topic()
      AND al.student_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.activities a
    WHERE ('activity:' || a.id::text) = realtime.topic()
      AND a.teacher_id = auth.uid()
  )
);

-- 2. message_reactions SELECT scoped to activity participants
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions"
ON public.message_reactions
FOR SELECT TO authenticated
USING (
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
);

-- 3. voice-notes bucket UPDATE policy (owner-scoped)
CREATE POLICY "Users can update own voice notes"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Lock down internal SECURITY DEFINER helpers from direct API execution
REVOKE EXECUTE ON FUNCTION public.create_attendance_notification() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_direct_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_email_domain() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_medical_visit_to_workout() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_dev_badge_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_activity_enrollment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_student_profile_required() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_signup_cooldown() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_theme_like_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_dev_badge() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_attendance_streak() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_workout_capacity() FROM anon, authenticated;
