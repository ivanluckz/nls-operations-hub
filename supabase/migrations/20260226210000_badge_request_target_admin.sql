-- Add target_admin_id so students can direct badge requests to a specific admin
ALTER TABLE public.badge_requests
  ADD COLUMN IF NOT EXISTS target_admin_id UUID REFERENCES auth.users(id);
