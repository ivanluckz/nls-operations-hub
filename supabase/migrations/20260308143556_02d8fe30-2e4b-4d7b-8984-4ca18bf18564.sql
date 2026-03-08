
-- Create is_medical function
CREATE OR REPLACE FUNCTION public.is_medical(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'medical'
  )
$$;

-- Medical visits table
CREATE TABLE public.medical_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medical_staff_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  condition text NOT NULL,
  treatment text,
  notes text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can insert visits" ON public.medical_visits
  FOR INSERT WITH CHECK (is_medical(auth.uid()) AND medical_staff_id = auth.uid());

CREATE POLICY "Medical staff and admins can view visits" ON public.medical_visits
  FOR SELECT USING (is_medical(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Medical staff can update own visits" ON public.medical_visits
  FOR UPDATE USING (is_medical(auth.uid()) AND medical_staff_id = auth.uid());

CREATE POLICY "Admins can manage visits" ON public.medical_visits
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Workout clearances table
CREATE TABLE public.workout_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleared_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'restricted',
  restriction_reason text,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_clearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medical staff can manage clearances" ON public.workout_clearances
  FOR ALL USING (is_medical(auth.uid())) WITH CHECK (is_medical(auth.uid()));

CREATE POLICY "RL coaches can view clearances" ON public.workout_clearances
  FOR SELECT USING (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Students can view own clearances" ON public.workout_clearances
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage clearances" ON public.workout_clearances
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_clearances;
