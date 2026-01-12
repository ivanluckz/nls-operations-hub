-- Fix activities RLS: Update policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view active activities" ON public.activities;

CREATE POLICY "Authenticated users can view active activities"
ON public.activities
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Fix profiles RLS: Add explicit authentication requirement
-- Drop and recreate view-related policies with auth check
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators and admins can view all profiles" ON public.profiles;

-- Recreate with explicit auth checks
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can view all profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND (is_moderator(auth.uid()) OR is_admin(auth.uid())));