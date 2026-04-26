-- 1. Allow 'medical' as a workout_attendance status
ALTER TABLE public.workout_attendance
  DROP CONSTRAINT IF EXISTS workout_attendance_status_check;

ALTER TABLE public.workout_attendance
  ADD CONSTRAINT workout_attendance_status_check
  CHECK (status IN ('present', 'late', 'absent', 'excused', 'medical'));

-- 2. Trigger: when a medical visit is logged, sync today's workout attendance to 'medical'
CREATE OR REPLACE FUNCTION public.sync_medical_visit_to_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_status text;
BEGIN
  -- Look for an existing workout_attendance row for that student on the visit date
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.workout_attendance
  WHERE student_id = NEW.student_id
    AND workout_date = NEW.visit_date
  ORDER BY scanned_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Don't overwrite a 'present' record (the student actually showed up before going to nurse)
    IF v_existing_status <> 'present' THEN
      UPDATE public.workout_attendance
      SET status = 'medical'
      WHERE id = v_existing_id;
    END IF;
  ELSE
    -- No record yet (student didn't show up) - create a medical-status record
    INSERT INTO public.workout_attendance (
      student_id, scanned_by, workout_date, location, status
    ) VALUES (
      NEW.student_id,
      NEW.medical_staff_id,
      NEW.visit_date,
      'Medical Office',
      'medical'
    )
    ON CONFLICT (student_id, workout_date, workout_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_medical_visit_workout ON public.medical_visits;
CREATE TRIGGER sync_medical_visit_workout
AFTER INSERT ON public.medical_visits
FOR EACH ROW
EXECUTE FUNCTION public.sync_medical_visit_to_workout();

-- 3. Allow medical staff to insert workout_attendance directly (defense in depth for the trigger
--    when not running as SECURITY DEFINER context, and for the manual excuse-workout action).
DROP POLICY IF EXISTS "Medical staff can insert workout attendance" ON public.workout_attendance;
CREATE POLICY "Medical staff can insert workout attendance"
ON public.workout_attendance
FOR INSERT
WITH CHECK (
  public.is_medical(auth.uid())
);

DROP POLICY IF EXISTS "Medical staff can update workout attendance" ON public.workout_attendance;
CREATE POLICY "Medical staff can update workout attendance"
ON public.workout_attendance
FOR UPDATE
USING (public.is_medical(auth.uid()))
WITH CHECK (public.is_medical(auth.uid()));

DROP POLICY IF EXISTS "Medical staff can view workout attendance" ON public.workout_attendance;
CREATE POLICY "Medical staff can view workout attendance"
ON public.workout_attendance
FOR SELECT
USING (public.is_medical(auth.uid()));