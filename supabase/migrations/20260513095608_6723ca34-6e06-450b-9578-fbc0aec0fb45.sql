-- Fix recursive profile/allocation policies and centralize activity-teacher checks
CREATE OR REPLACE FUNCTION public.is_activity_teacher(_activity_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.activities a
    WHERE a.id = _activity_id
      AND a.teacher_id = _user_id
  )
$function$;

REVOKE ALL ON FUNCTION public.is_activity_teacher(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_activity_teacher(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_activity_teacher(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Teachers can view allocations for their activities" ON public.allocations;
CREATE POLICY "Teachers can view allocations for assigned activities"
ON public.allocations
FOR SELECT
USING (
  public.is_activity_teacher(activity_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

DROP POLICY IF EXISTS "Teachers can view student profiles in their activities" ON public.profiles;
CREATE POLICY "Teachers can view student profiles in assigned activities"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.allocations al
    WHERE al.student_id = profiles.id
      AND public.is_activity_teacher(al.activity_id, auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.get_teacher_students(teacher_user_id uuid)
RETURNS TABLE(
  teacher_id uuid,
  activity_id uuid,
  activity_title text,
  day_of_week text,
  student_id uuid,
  student_name text,
  student_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    teacher_user_id AS teacher_id,
    a.id AS activity_id,
    a.title AS activity_title,
    CASE
      WHEN al.day_of_week ILIKE 'Wednesday Slot %' THEN 'Wednesday'
      ELSE al.day_of_week
    END AS day_of_week,
    p.id AS student_id,
    p.full_name AS student_name,
    p.email AS student_email
  FROM public.activities a
  JOIN public.allocations al ON al.activity_id = a.id
  JOIN public.profiles p ON p.id = al.student_id
  WHERE public.is_activity_teacher(a.id, teacher_user_id)
    AND p.banned = false
    AND (
      auth.uid() = teacher_user_id
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
    )
  ORDER BY a.title, day_of_week, p.full_name
$function$;

REVOKE ALL ON FUNCTION public.get_teacher_students(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_students(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_students(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_allocations_activity_day_slot
ON public.allocations(activity_id, day_of_week, slot_number);

CREATE INDEX IF NOT EXISTS idx_activities_teacher_id_active
ON public.activities(teacher_id, is_active);