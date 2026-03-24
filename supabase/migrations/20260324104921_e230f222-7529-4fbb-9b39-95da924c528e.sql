
-- Allow teachers to award badges to students in their activities
CREATE POLICY "Teachers can award badges to their students"
ON public.user_badges FOR INSERT TO public
WITH CHECK (
  awarded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM allocations al
    JOIN activities a ON a.id = al.activity_id
    WHERE al.student_id = user_badges.user_id
      AND a.teacher_id = auth.uid()
  )
);

-- Allow teachers to remove badges they awarded
CREATE POLICY "Teachers can remove badges they awarded"
ON public.user_badges FOR DELETE TO public
USING (
  awarded_by = auth.uid()
  AND has_role(auth.uid(), 'teacher')
);
