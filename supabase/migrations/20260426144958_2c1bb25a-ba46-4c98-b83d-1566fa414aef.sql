-- Allow admins, moderators, and teachers to mark workout attendance
CREATE POLICY "Admins and mods can insert workout records"
ON public.workout_attendance
FOR INSERT
WITH CHECK ((is_admin(auth.uid()) OR is_moderator(auth.uid())) AND scanned_by = auth.uid());

CREATE POLICY "Teachers can insert workout records"
ON public.workout_attendance
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND scanned_by = auth.uid());

CREATE POLICY "Teachers can view workout records"
ON public.workout_attendance
FOR SELECT
USING (has_role(auth.uid(), 'teacher'::app_role));