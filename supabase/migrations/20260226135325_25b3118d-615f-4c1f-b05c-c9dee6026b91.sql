
-- Allow students to delete their own messages
CREATE POLICY "Students can delete their own messages"
ON public.activity_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Allow students to see profiles of peers in the same activities
CREATE POLICY "Students can view activity peer profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND id IN (
    SELECT al2.student_id 
    FROM allocations al1
    JOIN allocations al2 ON al1.activity_id = al2.activity_id
    WHERE al1.student_id = auth.uid()
  )
);

-- Also allow students to see teacher profiles (activity teacher_id)
CREATE POLICY "Students can view teacher profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND id IN (
    SELECT a.teacher_id
    FROM activities a
    JOIN allocations al ON al.activity_id = a.id
    WHERE al.student_id = auth.uid()
    AND a.teacher_id IS NOT NULL
  )
);
