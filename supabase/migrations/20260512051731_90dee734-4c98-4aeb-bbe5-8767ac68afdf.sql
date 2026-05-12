-- Fix infinite recursion in profiles RLS by removing inline subquery on profiles
DROP POLICY IF EXISTS "Teachers can view student profiles in their activities" ON public.profiles;

CREATE POLICY "Teachers can view student profiles in their activities"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM allocations al
    JOIN activities a ON a.id = al.activity_id
    WHERE al.student_id = profiles.id
      AND a.teacher_id = auth.uid()
  )
);