
-- Locations table
CREATE TABLE public.workout_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '💪',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active locations"
  ON public.workout_locations FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_active = true OR is_admin(auth.uid()) OR is_moderator(auth.uid())));

CREATE POLICY "Admins and mods manage locations"
  ON public.workout_locations FOR ALL
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Sessions table
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location_id uuid REFERENCES public.workout_locations(id) ON DELETE SET NULL,
  day_of_week text NOT NULL,
  start_time time NOT NULL DEFAULT '06:00',
  capacity integer NOT NULL DEFAULT 30,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active sessions"
  ON public.workout_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_active = true OR is_admin(auth.uid()) OR is_moderator(auth.uid())));

CREATE POLICY "Admins and mods manage sessions"
  ON public.workout_sessions FOR ALL
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Signups table
CREATE TABLE public.workout_session_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

ALTER TABLE public.workout_session_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own signups"
  ON public.workout_session_signups FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Admins and mods view all signups"
  ON public.workout_session_signups FOR SELECT
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Students sign themselves up"
  ON public.workout_session_signups FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students remove own signup"
  ON public.workout_session_signups FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "Admins and mods manage signups"
  ON public.workout_session_signups FOR ALL
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER trg_workout_locations_updated
  BEFORE UPDATE ON public.workout_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_workout_sessions_updated
  BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed existing locations
INSERT INTO public.workout_locations (name, emoji, description) VALUES
  ('Courts', '🏀', 'Basketball, volleyball, etc.'),
  ('Pitch', '⚽', 'Football, rugby, track'),
  ('Competition', '🏆', 'Competition prep & drills')
ON CONFLICT (name) DO NOTHING;
