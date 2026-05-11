-- Fix RLS policies so teachers can take attendance

-- 1. Drop and recreate allocations policy to include teacher_in_charge
DROP POLICY IF EXISTS "Teachers can view allocations for their activities" ON public.allocations;

CREATE POLICY "Teachers can view allocations for their activities"
  ON public.allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = allocations.activity_id
      AND (
        activities.teacher_id = auth.uid()
        OR activities.teacher_in_charge ILIKE '%' || (SELECT email FROM profiles WHERE id = auth.uid()) || '%'
      )
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  );

-- 2. Add policy for teachers to view student profiles in their activities
DROP POLICY IF EXISTS "Teachers can view student profiles in their activities" ON public.profiles;

CREATE POLICY "Teachers can view student profiles in their activities"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM allocations al
      JOIN activities a ON a.id = al.activity_id
      WHERE al.student_id = profiles.id
      AND (
        a.teacher_id = auth.uid()
        OR a.teacher_in_charge ILIKE '%' || (SELECT email FROM profiles WHERE id = auth.uid()) || '%'
      )
    )
  );

-- 3. Verify policies
SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('allocations', 'profiles') AND policyname LIKE '%Teacher%';
