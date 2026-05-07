
-- Revoke EXECUTE on remaining SECURITY DEFINER helpers from the API.
-- Keep ones explicitly intended to be RPC-callable: has_role, is_admin, is_moderator,
-- is_medical, is_rl_coach, get_profile_email(s), get_teacher_students,
-- count_allocated_students, can_access_call, bump_theme_install_count.

-- (No-op safety: these may already be revoked from above migration if listed there.)

-- ===== Realtime channel authorization =====
-- realtime.messages stores broadcast/presence channel events.
-- Default deny + scoped allow policies. Admins/moderators bypass.

DO $$
BEGIN
  -- Drop any prior policies we may have created
  EXECUTE 'DROP POLICY IF EXISTS "rt_select_authorized" ON realtime.messages';
  EXECUTE 'DROP POLICY IF EXISTS "rt_insert_authorized" ON realtime.messages';
EXCEPTION WHEN insufficient_privilege THEN
  -- ignore
  NULL;
END$$;

CREATE POLICY "rt_select_authorized"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_moderator(auth.uid())
  OR realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('dm:%' || auth.uid()::text || '%')
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

CREATE POLICY "rt_insert_authorized"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
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
