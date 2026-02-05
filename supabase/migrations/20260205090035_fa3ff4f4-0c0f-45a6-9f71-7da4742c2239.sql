-- Add RLS policy to allow students to view their own attendance notifications
-- This enables transparency so students can see when they're marked absent/late/excused

CREATE POLICY "Students can view their own notifications"
ON public.attendance_notifications
FOR SELECT
USING (auth.uid() = student_id);