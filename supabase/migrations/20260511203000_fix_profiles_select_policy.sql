-- Ensure profile SELECT policies are correct for authenticated users
-- This fixes broken profile reads that can cause authenticated users to be redirected
-- to the student dashboard when their role cannot be resolved.

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators and admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_moderator(auth.uid()) OR is_admin(auth.uid())));
