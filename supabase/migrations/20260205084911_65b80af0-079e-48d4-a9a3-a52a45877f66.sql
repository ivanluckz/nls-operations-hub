-- Fix 1: Remove hardcoded admin/teacher role assignment from handle_new_user trigger
-- Default all new users to 'student' role - admins should promote users via UI
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Default all users to student role
  -- Admins can promote users to other roles via the admin UI
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

-- Fix 2: Add RLS policy for teachers to view allocations for their activities
CREATE POLICY "Teachers can view allocations for their activities"
  ON allocations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = allocations.activity_id
      AND activities.teacher_id = auth.uid()
    )
  );