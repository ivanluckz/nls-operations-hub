
-- Attendance streaks table
CREATE TABLE public.attendance_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_type text NOT NULL CHECK (streak_type IN ('activity', 'meal', 'workout')),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_recorded_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, streak_type)
);

ALTER TABLE public.attendance_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own streaks" ON public.attendance_streaks
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins and mods can view all streaks" ON public.attendance_streaks
  FOR SELECT USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Streak milestones table
CREATE TABLE public.streak_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_type text NOT NULL CHECK (milestone_type IN ('7_day', '14_day', '30_day', '50_day', '100_day')),
  streak_type text NOT NULL CHECK (streak_type IN ('activity', 'meal', 'workout')),
  achieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, milestone_type, streak_type)
);

ALTER TABLE public.streak_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own milestones" ON public.streak_milestones
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins and mods can view all milestones" ON public.streak_milestones
  FOR SELECT USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Streak update trigger function
CREATE OR REPLACE FUNCTION public.update_attendance_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_streak_type text;
  v_current_streak integer;
  v_longest_streak integer;
  v_last_date date;
  v_today date := CURRENT_DATE;
  v_milestone integer;
BEGIN
  -- Determine student_id and streak_type based on trigger source
  IF TG_TABLE_NAME = 'attendance_records' THEN
    v_student_id := NEW.student_id;
    v_streak_type := 'activity';
  ELSIF TG_TABLE_NAME = 'meal_attendance' THEN
    v_student_id := NEW.student_id;
    v_streak_type := 'meal';
  ELSIF TG_TABLE_NAME = 'workout_attendance' THEN
    v_student_id := NEW.student_id;
    v_streak_type := 'workout';
  ELSE
    RETURN NEW;
  END IF;

  -- Check if streak row exists
  SELECT current_streak, longest_streak, last_recorded_date
  INTO v_current_streak, v_longest_streak, v_last_date
  FROM attendance_streaks
  WHERE student_id = v_student_id AND streak_type = v_streak_type;

  IF NOT FOUND THEN
    -- Create new streak row
    INSERT INTO attendance_streaks (student_id, streak_type, current_streak, longest_streak, last_recorded_date)
    VALUES (v_student_id, v_streak_type, 1, 1, v_today);
    v_current_streak := 1;
    v_longest_streak := 1;
  ELSIF v_last_date = v_today THEN
    -- Already recorded today, no-op
    RETURN NEW;
  ELSIF v_last_date = v_today - 1 THEN
    -- Consecutive day
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
    UPDATE attendance_streaks
    SET current_streak = v_current_streak, longest_streak = v_longest_streak,
        last_recorded_date = v_today, updated_at = now()
    WHERE student_id = v_student_id AND streak_type = v_streak_type;
  ELSE
    -- Streak broken, reset
    v_current_streak := 1;
    UPDATE attendance_streaks
    SET current_streak = 1, last_recorded_date = v_today, updated_at = now()
    WHERE student_id = v_student_id AND streak_type = v_streak_type;
  END IF;

  -- Check milestones (7, 14, 30, 50, 100)
  FOREACH v_milestone IN ARRAY ARRAY[7, 14, 30, 50, 100]
  LOOP
    IF v_current_streak >= v_milestone THEN
      INSERT INTO streak_milestones (student_id, milestone_type, streak_type)
      VALUES (v_student_id, v_milestone || '_day', v_streak_type)
      ON CONFLICT (student_id, milestone_type, streak_type) DO NOTHING;
    END IF;
  END LOOP;

  -- Auto-award badges at milestones
  IF v_current_streak = 7 THEN
    INSERT INTO user_badges (user_id, badge_name) VALUES (v_student_id, 'On Fire')
    ON CONFLICT DO NOTHING;
  ELSIF v_current_streak = 30 THEN
    INSERT INTO user_badges (user_id, badge_name) VALUES (v_student_id, 'Star Student')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers on the three tables
CREATE TRIGGER trg_streak_attendance_records
  AFTER INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_attendance_streak();

CREATE TRIGGER trg_streak_meal_attendance
  AFTER INSERT ON public.meal_attendance
  FOR EACH ROW EXECUTE FUNCTION update_attendance_streak();

CREATE TRIGGER trg_streak_workout_attendance
  AFTER INSERT ON public.workout_attendance
  FOR EACH ROW EXECUTE FUNCTION update_attendance_streak();
