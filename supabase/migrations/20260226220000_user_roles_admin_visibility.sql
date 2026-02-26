-- Allow any authenticated user to see which users are admins
-- (needed so students can pick a target admin for badge requests)
CREATE POLICY "Anyone can view admin roles"
  ON public.user_roles FOR SELECT
  USING (role = 'admin');
