-- Create the missing allocation_audit_log table for rate limiting and audit tracking
CREATE TABLE public.allocation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  allocations_created integer,
  validation_errors integer,
  error_message text
);

-- Enable Row Level Security
ALTER TABLE public.allocation_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and moderators can view audit logs
CREATE POLICY "Admins and moderators can view audit log"
  ON public.allocation_audit_log FOR SELECT
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Only admins and moderators can insert audit log entries
CREATE POLICY "Admins and moderators can insert audit log"
  ON public.allocation_audit_log FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Only admins and moderators can update audit log entries
CREATE POLICY "Admins and moderators can update audit log"
  ON public.allocation_audit_log FOR UPDATE
  USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

-- Create indexes for efficient queries
CREATE INDEX idx_audit_triggered_by ON public.allocation_audit_log(triggered_by);
CREATE INDEX idx_audit_started_at ON public.allocation_audit_log(started_at);