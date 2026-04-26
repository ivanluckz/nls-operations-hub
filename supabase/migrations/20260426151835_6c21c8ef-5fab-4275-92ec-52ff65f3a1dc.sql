
-- 1. Drop old tables (no data)
DROP TABLE IF EXISTS public.workout_session_signups CASCADE;
DROP TABLE IF EXISTS public.workout_sessions CASCADE;
DROP TABLE IF EXISTS public.workout_locations CASCADE;

-- 2. New workouts table (one workout = name + weekdays + capacity)
CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  days_of_week text[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  capacity integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workouts_updated
BEFORE UPDATE ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active workouts"
ON public.workouts FOR SELECT
USING (auth.uid() IS NOT NULL AND (is_active = true OR is_admin(auth.uid()) OR is_moderator(auth.uid())));

CREATE POLICY "Admins and mods manage workouts"
ON public.workouts FOR ALL
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 3. Workout teachers junction
CREATE TABLE public.workout_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, teacher_id)
);

ALTER TABLE public.workout_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view workout teachers"
ON public.workout_teachers FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and mods manage workout teachers"
ON public.workout_teachers FOR ALL
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 4. Workout signups (student joins a workout)
CREATE TABLE public.workout_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, student_id)
);

ALTER TABLE public.workout_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own signups"
ON public.workout_signups FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Assigned teachers view signups"
ON public.workout_signups FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.workout_teachers wt
  WHERE wt.workout_id = workout_signups.workout_id AND wt.teacher_id = auth.uid()
));

CREATE POLICY "Admins and mods view all signups"
ON public.workout_signups FOR SELECT
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Students create own signup"
ON public.workout_signups FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students delete own signup"
ON public.workout_signups FOR DELETE
USING (auth.uid() = student_id);

CREATE POLICY "Admins and mods manage signups"
ON public.workout_signups FOR ALL
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- 5. Update workout_attendance: link to workouts
ALTER TABLE public.workout_attendance
  ADD COLUMN IF NOT EXISTS workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL;

-- Drop the old per-day unique constraint and replace with per-workout-per-day
ALTER TABLE public.workout_attendance DROP CONSTRAINT IF EXISTS workout_attendance_unique;
ALTER TABLE public.workout_attendance
  ADD CONSTRAINT workout_attendance_unique UNIQUE (student_id, workout_date, workout_id);

-- Allow assigned teachers to mark attendance for their own workouts
DROP POLICY IF EXISTS "Teachers can insert workout records" ON public.workout_attendance;

CREATE POLICY "Assigned teachers insert workout attendance"
ON public.workout_attendance FOR INSERT
WITH CHECK (
  scanned_by = auth.uid()
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (
    workout_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workout_teachers wt
      WHERE wt.workout_id = workout_attendance.workout_id AND wt.teacher_id = auth.uid()
    )
  )
);

CREATE POLICY "Assigned teachers view workout attendance"
ON public.workout_attendance FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND workout_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.workout_teachers wt
    WHERE wt.workout_id = workout_attendance.workout_id AND wt.teacher_id = auth.uid()
  )
);
