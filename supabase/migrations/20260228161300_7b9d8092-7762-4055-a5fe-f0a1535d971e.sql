
-- Periods: P1–P8 + breaks
CREATE TABLE IF NOT EXISTS public.academic_periods (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN DEFAULT false,
  sort_order INT NOT NULL
);

INSERT INTO public.academic_periods (label, start_time, end_time, is_break, sort_order) VALUES
  ('P1','07:30','08:20',false,1),('P2','08:20','09:10',false,2),
  ('Morning Break','09:10','09:30',true,3),
  ('P3','09:30','10:20',false,4),('P4','10:20','11:10',false,5),
  ('P5','11:10','12:00',false,6),
  ('Lunch','12:00','13:00',true,7),
  ('P6','13:00','13:50',false,8),('P7','13:50','14:40',false,9),
  ('P8','14:40','15:30',false,10)
ON CONFLICT DO NOTHING;

ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.academic_periods FOR SELECT TO authenticated USING (true);

-- Subjects
CREATE TABLE IF NOT EXISTS public.academic_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.academic_subjects (name, code, color) VALUES
  ('English Language and Literature','ENG','#3b82f6'),
  ('Kinyarwanda Language and Literature','KIN','#10b981'),
  ('German Language Acquisition Phase 1','GER1','#f59e0b'),
  ('German Language Acquisition Phase 2','GER2','#f59e0b'),
  ('German Language Acquisition Phase 3','GER3','#f59e0b'),
  ('Integrated Humanities','HUM','#8b5cf6'),
  ('Biology','BIO','#22c55e'),
  ('Chemistry','CHEM','#ef4444'),
  ('Physics','PHY','#06b6d4'),
  ('Math Standard','MATS','#f97316'),
  ('Math Extended','MATE','#ea580c'),
  ('Visual Arts','ART','#ec4899'),
  ('Physical and Health Education','PHE','#84cc16'),
  ('Design','DES','#0ea5e9')
ON CONFLICT DO NOTHING;

ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.academic_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.academic_subjects FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')));

-- Class groups
CREATE TABLE IF NOT EXISTS public.class_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.class_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.class_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')));

-- Class group members
CREATE TABLE IF NOT EXISTS public.class_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_group_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  UNIQUE(class_group_id, student_id)
);

ALTER TABLE public.class_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.class_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.class_group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')));

-- Timetable slots
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.academic_subjects(id),
  teacher_id UUID,
  class_group_id UUID REFERENCES public.class_groups(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  period_number INT NOT NULL,
  room TEXT,
  is_elective BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.timetable_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')));

-- Timetable enrollments (for elective slots)
CREATE TABLE IF NOT EXISTS public.timetable_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  UNIQUE(slot_id, student_id)
);

ALTER TABLE public.timetable_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.timetable_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON public.timetable_enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')));

-- Academic sessions
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.timetable_slots(id),
  session_date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slot_id, session_date)
);

ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.academic_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "teacher_sessions" ON public.academic_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM timetable_slots ts WHERE ts.id=slot_id AND (ts.teacher_id=auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator')))));

-- Academic attendance
CREATE TABLE IF NOT EXISTS public.academic_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.academic_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON public.academic_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "teacher_attendance" ON public.academic_attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('admin','moderator','teacher')));
