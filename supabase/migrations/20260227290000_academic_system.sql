-- ============================================================
-- ACADEMIC TIMETABLE & ATTENDANCE SYSTEM
-- Migration: 20260227290000_academic_system.sql
-- ============================================================

-- 1. Period structure (P1–P8, breaks)
CREATE TABLE IF NOT EXISTS public.academic_periods (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_number INT NOT NULL,
  label         TEXT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_break      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT academic_periods_number_unique UNIQUE (period_number)
);

-- 2. Subjects (Math, English, Science…)
CREATE TABLE IF NOT EXISTS public.academic_subjects (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Class groups (Form 3A, Lower 6 Science…)
CREATE TABLE IF NOT EXISTS public.class_groups (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  year_level  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 4. Student membership in class groups (many-to-many)
CREATE TABLE IF NOT EXISTS public.class_group_members (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_group_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT class_group_members_unique UNIQUE (class_group_id, student_id)
);

-- 5. Master timetable slots
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id     UUID NOT NULL REFERENCES public.academic_subjects(id) ON DELETE RESTRICT,
  teacher_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  class_group_id UUID REFERENCES public.class_groups(id) ON DELETE RESTRICT,
  day_of_week    TEXT NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_number  INT NOT NULL,
  room           TEXT,
  is_elective    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT timetable_slots_group_no_double_book
    UNIQUE NULLS NOT DISTINCT (class_group_id, day_of_week, period_number),
  CONSTRAINT timetable_slots_teacher_no_double_book
    UNIQUE (teacher_id, day_of_week, period_number)
);

-- 6. Elective enrollment (individual students into elective slots)
CREATE TABLE IF NOT EXISTS public.timetable_enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id     UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT timetable_enrollments_unique UNIQUE (slot_id, student_id)
);

-- 7. Individual lesson occurrences (created when teacher opens attendance)
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id      UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  teacher_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finalized')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  CONSTRAINT academic_sessions_unique UNIQUE (slot_id, session_date)
);

-- 8. Attendance per student per session
CREATE TABLE IF NOT EXISTS public.academic_attendance (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'absent'
             CHECK (status IN ('present','late','absent','excused')),
  marked_at  TIMESTAMPTZ DEFAULT now(),
  marked_by  UUID REFERENCES auth.users(id),
  CONSTRAINT academic_attendance_unique UNIQUE (session_id, student_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_timetable_slots_teacher     ON public.timetable_slots (teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_class_group ON public.timetable_slots (class_group_id);
CREATE INDEX IF NOT EXISTS idx_class_group_members_student ON public.class_group_members (student_id);
CREATE INDEX IF NOT EXISTS idx_timetable_enrollments_student ON public.timetable_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_academic_sessions_slot_date ON public.academic_sessions (slot_id, session_date);
CREATE INDEX IF NOT EXISTS idx_academic_attendance_session ON public.academic_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_academic_attendance_student ON public.academic_attendance (student_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.academic_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_attendance   ENABLE ROW LEVEL SECURITY;

-- academic_periods: everyone can read, only admin can write
CREATE POLICY "academic_periods_read_all"
  ON public.academic_periods FOR SELECT USING (true);

CREATE POLICY "academic_periods_admin_write"
  ON public.academic_periods FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- academic_subjects: authenticated read, admin+mod write
CREATE POLICY "academic_subjects_read_auth"
  ON public.academic_subjects FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "academic_subjects_admin_mod_write"
  ON public.academic_subjects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- class_groups: authenticated read, admin+mod write
CREATE POLICY "class_groups_read_auth"
  ON public.class_groups FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_groups_admin_mod_write"
  ON public.class_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- class_group_members: authenticated read, admin+mod write
CREATE POLICY "class_group_members_read_auth"
  ON public.class_group_members FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_group_members_admin_mod_write"
  ON public.class_group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- timetable_slots: authenticated read, admin+mod write
CREATE POLICY "timetable_slots_read_auth"
  ON public.timetable_slots FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "timetable_slots_admin_mod_write"
  ON public.timetable_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- timetable_enrollments: authenticated read, admin+mod write
CREATE POLICY "timetable_enrollments_read_auth"
  ON public.timetable_enrollments FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "timetable_enrollments_admin_mod_write"
  ON public.timetable_enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

-- academic_sessions: teacher owns their own; admin+mod full; students read
CREATE POLICY "academic_sessions_teacher_own"
  ON public.academic_sessions FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "academic_sessions_admin_mod"
  ON public.academic_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "academic_sessions_student_read"
  ON public.academic_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.timetable_slots ts
      LEFT JOIN public.class_group_members cgm ON cgm.class_group_id = ts.class_group_id AND cgm.student_id = auth.uid()
      LEFT JOIN public.timetable_enrollments te ON te.slot_id = ts.id AND te.student_id = auth.uid()
      WHERE ts.id = slot_id AND (cgm.student_id IS NOT NULL OR te.student_id IS NOT NULL)
    )
  );

-- academic_attendance: teacher marks for their sessions; admin+mod full; student reads own
CREATE POLICY "academic_attendance_teacher_mark"
  ON public.academic_attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM public.academic_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.academic_sessions s WHERE s.id = session_id AND s.teacher_id = auth.uid()));

CREATE POLICY "academic_attendance_admin_mod"
  ON public.academic_attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')));

CREATE POLICY "academic_attendance_student_read_own"
  ON public.academic_attendance FOR SELECT
  USING (student_id = auth.uid());

-- ============================================================
-- SEED: Default period structure (only if table is empty)
-- ============================================================
INSERT INTO public.academic_periods (period_number, label, start_time, end_time, is_break)
SELECT period_number, label, start_time::TIME, end_time::TIME, is_break
FROM (VALUES
  (1,  'Period 1',       '07:30', '08:20', false),
  (2,  'Period 2',       '08:20', '09:10', false),
  (3,  'Period 3',       '09:10', '10:00', false),
  (4,  'Morning Break',  '10:00', '10:20', true),
  (5,  'Period 4',       '10:20', '11:10', false),
  (6,  'Period 5',       '11:10', '12:00', false),
  (7,  'Lunch',          '12:00', '13:00', true),
  (8,  'Period 6',       '13:00', '13:50', false),
  (9,  'Period 7',       '13:50', '14:40', false),
  (10, 'Period 8',       '14:40', '15:30', false)
) AS v(period_number, label, start_time, end_time, is_break)
WHERE NOT EXISTS (SELECT 1 FROM public.academic_periods LIMIT 1);
