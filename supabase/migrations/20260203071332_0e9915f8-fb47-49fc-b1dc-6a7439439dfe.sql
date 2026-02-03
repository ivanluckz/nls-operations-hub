-- Fix overlapping SELECT policies on profiles table
-- Remove redundant "Admins can view all profiles" policy since it's already covered by "Moderators and admins can view all profiles"

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- The remaining policies are:
-- 1. "Users can view their own profile" - auth.uid() = id
-- 2. "Moderators and admins can view all profiles" - is_moderator(auth.uid()) OR is_admin(auth.uid())
-- These provide proper access: users see only their own profile, mods/admins see all