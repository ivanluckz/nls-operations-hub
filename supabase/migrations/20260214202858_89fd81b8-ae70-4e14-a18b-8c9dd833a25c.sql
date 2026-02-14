
-- Create message type enum
CREATE TYPE public.message_type AS ENUM ('announcement', 'discussion');

-- Create activity messages table
CREATE TABLE public.activity_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_type message_type NOT NULL DEFAULT 'discussion',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;

-- Teachers can send messages to their activities
CREATE POLICY "Teachers can insert messages to their activities"
ON public.activity_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM activities WHERE id = activity_id AND teacher_id = auth.uid()
  )
);

-- Students can send discussion messages to activities they're allocated to
CREATE POLICY "Students can send discussion messages"
ON public.activity_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND message_type = 'discussion'
  AND EXISTS (
    SELECT 1 FROM allocations WHERE activity_id = activity_messages.activity_id AND student_id = auth.uid()
  )
);

-- Teachers can view messages for their activities
CREATE POLICY "Teachers can view messages for their activities"
ON public.activity_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM activities WHERE id = activity_id AND teacher_id = auth.uid()
  )
);

-- Students can view messages for activities they're allocated to
CREATE POLICY "Students can view messages for their activities"
ON public.activity_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM allocations WHERE activity_id = activity_messages.activity_id AND student_id = auth.uid()
  )
);

-- Admins and moderators can view all messages
CREATE POLICY "Admins and mods can view all messages"
ON public.activity_messages
FOR SELECT
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Teachers can delete their own messages
CREATE POLICY "Teachers can delete their own messages"
ON public.activity_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_messages;

-- Index for fast lookups
CREATE INDEX idx_activity_messages_activity_id ON public.activity_messages(activity_id);
CREATE INDEX idx_activity_messages_created_at ON public.activity_messages(created_at DESC);
