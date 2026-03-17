
-- Allow teachers who are mentors to insert meal_attendance for lunch
CREATE POLICY "Mentor teachers can insert lunch records"
ON public.meal_attendance
FOR INSERT
TO public
WITH CHECK (
  scanned_by = auth.uid()
  AND meal_type = 'lunch'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'teacher'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE mentor_id = auth.uid()
  )
);

-- Allow mentor teachers to view meal records
CREATE POLICY "Mentor teachers can view meal records"
ON public.meal_attendance
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'teacher'
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE mentor_id = auth.uid()
  )
);
