-- Replace overly broad mentor-teacher meal_attendance policies with student-scoped versions
DROP POLICY IF EXISTS "Mentor teachers can view meal records" ON public.meal_attendance;
DROP POLICY IF EXISTS "Mentor teachers can insert lunch records" ON public.meal_attendance;

CREATE POLICY "Mentor teachers can view their mentees meal records"
  ON public.meal_attendance FOR SELECT
  USING (
    has_role(auth.uid(), 'teacher')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = meal_attendance.student_id
        AND p.mentor_id = auth.uid()
    )
  );

CREATE POLICY "Mentor teachers can insert lunch for their mentees"
  ON public.meal_attendance FOR INSERT
  WITH CHECK (
    scanned_by = auth.uid()
    AND meal_type = 'lunch'
    AND has_role(auth.uid(), 'teacher')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = meal_attendance.student_id
        AND p.mentor_id = auth.uid()
    )
  );