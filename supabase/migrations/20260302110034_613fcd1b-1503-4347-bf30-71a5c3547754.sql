
-- Create student_requests table
CREATE TABLE public.student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  request_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert their own requests
CREATE POLICY "Students can insert own requests"
ON public.student_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Students can view their own requests
CREATE POLICY "Students can view own requests"
ON public.student_requests FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Admins and moderators can view all requests
CREATE POLICY "Admins and mods can view all requests"
ON public.student_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()));

-- Admins and moderators can update requests (approve/deny)
CREATE POLICY "Admins and mods can update requests"
ON public.student_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_requests;
