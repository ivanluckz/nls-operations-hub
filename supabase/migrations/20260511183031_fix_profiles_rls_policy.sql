-- Fix missing RLS policy: allow users to view their own profile
-- This was accidentally removed during the role migration

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);