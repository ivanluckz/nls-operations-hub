-- Allow any authenticated user to see profiles of admins
-- (needed so students can look up an admin by email for badge requests)
CREATE POLICY "Anyone can view admin profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = profiles.id AND role = 'admin'
    )
  );
