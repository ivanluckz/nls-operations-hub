
-- Create houses table
CREATE TABLE public.houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view houses" ON public.houses
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage houses" ON public.houses
  FOR ALL USING (is_admin(auth.uid()));

-- Insert the 8 houses
INSERT INTO public.houses (name, color) VALUES
  ('Amistad', '#EF4444'),
  ('Altruismo', '#3B82F6'),
  ('Sollevare', '#10B981'),
  ('Nukumori', '#F59E0B'),
  ('Protos', '#8B5CF6'),
  ('Onraka', '#EC4899'),
  ('Reveur', '#06B6D4'),
  ('Isibindi', '#F97316');

-- Add house_id to profiles
ALTER TABLE public.profiles ADD COLUMN house_id uuid REFERENCES public.houses(id);

-- Create is_rl_coach function
CREATE OR REPLACE FUNCTION public.is_rl_coach(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'rl_coach'
  )
$$;

-- Create workout_attendance table
CREATE TABLE public.workout_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scanned_by uuid NOT NULL,
  workout_date date NOT NULL DEFAULT CURRENT_DATE,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'present',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_attendance_unique UNIQUE (student_id, workout_date)
);

ALTER TABLE public.workout_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RL coaches can insert workout records" ON public.workout_attendance
  FOR INSERT WITH CHECK (is_rl_coach(auth.uid()) AND scanned_by = auth.uid());

CREATE POLICY "RL coaches and admins can view workout records" ON public.workout_attendance
  FOR SELECT USING (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Admins can manage workout records" ON public.workout_attendance
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Update meal_attendance RLS for rl_coach
DROP POLICY IF EXISTS "Kitchen staff can insert meal records" ON public.meal_attendance;
CREATE POLICY "RL coaches can insert meal records" ON public.meal_attendance
  FOR INSERT WITH CHECK ((is_rl_coach(auth.uid()) OR has_role(auth.uid(), 'kitchen_staff'::app_role)) AND scanned_by = auth.uid());

DROP POLICY IF EXISTS "Kitchen staff can view meal records" ON public.meal_attendance;
CREATE POLICY "RL coaches and admins can view meal records" ON public.meal_attendance
  FOR SELECT USING (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_attendance;
