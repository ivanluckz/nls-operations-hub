-- Create attendance sessions table
CREATE TABLE public.attendance_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  session_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  slot_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalized_at TIMESTAMP WITH TIME ZONE
);

-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'late', 'absent')),
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  marked_by UUID NOT NULL,
  UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attendance_sessions
CREATE POLICY "Teachers can view their own sessions"
  ON public.attendance_sessions FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create their own sessions"
  ON public.attendance_sessions FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own sessions"
  ON public.attendance_sessions FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Moderators and admins can view all sessions"
  ON public.attendance_sessions FOR SELECT
  USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- RLS Policies for attendance_records
CREATE POLICY "Teachers can manage records in their sessions"
  ON public.attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions
      WHERE attendance_sessions.id = attendance_records.session_id
      AND attendance_sessions.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own records"
  ON public.attendance_records FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Moderators and admins can view all records"
  ON public.attendance_records FOR SELECT
  USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_attendance_sessions_teacher ON public.attendance_sessions(teacher_id);
CREATE INDEX idx_attendance_sessions_activity ON public.attendance_sessions(activity_id);
CREATE INDEX idx_attendance_sessions_date ON public.attendance_sessions(session_date);
CREATE INDEX idx_attendance_records_session ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_records_student ON public.attendance_records(student_id);