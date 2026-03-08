
-- Workout notifications table
CREATE TABLE public.workout_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  status text NOT NULL DEFAULT 'absent',
  notified_at timestamptz DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_notifications_unique UNIQUE (student_id, workout_date)
);

ALTER TABLE public.workout_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RL coaches and admins can manage workout notifications" ON public.workout_notifications
  FOR ALL USING (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()))
  WITH CHECK (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Students can view own workout notifications" ON public.workout_notifications
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Medical staff can view workout notifications" ON public.workout_notifications
  FOR SELECT USING (is_medical(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_notifications;
