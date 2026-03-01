
-- Table: academic_excuses
CREATE TABLE public.academic_excuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  excuse_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id, slot_id, excuse_date)
);

ALTER TABLE public.academic_excuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and mods can manage excuses"
ON public.academic_excuses FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()));

CREATE POLICY "Teachers can manage excuses for their slots"
ON public.academic_excuses FOR ALL
USING (EXISTS (
  SELECT 1 FROM timetable_slots ts
  WHERE ts.id = academic_excuses.slot_id AND ts.teacher_id = auth.uid()
));

CREATE POLICY "Students can view their own excuses"
ON public.academic_excuses FOR SELECT
USING (auth.uid() = student_id);

-- Table: academic_messages
CREATE TABLE public.academic_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'discussion',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.academic_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and mods can manage all messages"
ON public.academic_messages FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()));

CREATE POLICY "Class members can view messages"
ON public.academic_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM class_group_members cgm
  WHERE cgm.class_group_id = academic_messages.class_group_id AND cgm.student_id = auth.uid()
));

CREATE POLICY "Class members can send messages"
ON public.academic_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM class_group_members cgm
    WHERE cgm.class_group_id = academic_messages.class_group_id AND cgm.student_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own messages"
ON public.academic_messages FOR DELETE
USING (auth.uid() = sender_id);

CREATE POLICY "Teachers can view messages for their classes"
ON public.academic_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM timetable_slots ts
  WHERE ts.class_group_id = academic_messages.class_group_id AND ts.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can send messages to their classes"
ON public.academic_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM timetable_slots ts
    WHERE ts.class_group_id = academic_messages.class_group_id AND ts.teacher_id = auth.uid()
  )
);

-- Enable realtime for academic_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_messages;
