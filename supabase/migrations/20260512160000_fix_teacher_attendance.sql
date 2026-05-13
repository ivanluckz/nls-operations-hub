-- Fix teacher attendance: CHECK constraint + allocations RLS
-- Issue 1: attendance_sessions.status CHECK only allows ('draft','finalized')
--          but the app sets status to 'submitted' on finalization.
-- Issue 2: allocations RLS was stripped of teacher_in_charge matching,
--          so teachers assigned via email see 0 students.

-- 1. Fix the CHECK constraint: add 'submitted' to allowed status values
ALTER TABLE public.attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_status_check;
ALTER TABLE public.attendance_sessions ADD CONSTRAINT attendance_sessions_status_check
  CHECK (status IN ('draft', 'submitted', 'finalized'));

-- 2. Restore teacher_in_charge email matching in allocations RLS
DROP POLICY IF EXISTS "Teachers can view allocations for their activities" ON public.allocations;
CREATE POLICY "Teachers can view allocations for their activities"
ON public.allocations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = allocations.activity_id
    AND (
      a.teacher_id = auth.uid()
      OR a.teacher_in_charge ILIKE '%' || (
        SELECT email FROM public.profiles WHERE id = auth.uid()
      ) || '%'
    )
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);
