-- 1. Allow admins/mods to create attendance sessions
CREATE POLICY "Admins and mods can create sessions"
ON public.attendance_sessions FOR INSERT
TO public
WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 2. Allow admins/mods to update attendance sessions
CREATE POLICY "Admins and mods can update sessions"
ON public.attendance_sessions FOR UPDATE
TO public
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 3. Allow admins/mods to manage all attendance records
CREATE POLICY "Admins and mods can manage records"
ON public.attendance_records FOR ALL
TO public
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 4. Add unique constraint for upsert to work on attendance_notifications
ALTER TABLE public.attendance_notifications 
ADD CONSTRAINT attendance_notifications_session_student_activity_unique 
UNIQUE (session_id, student_id, activity_id);