-- Phase 1: Critical Security Fixes

-- 1. Create security definer function to check moderator role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_moderator(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role = 'moderator'::user_role
  );
$$;

-- 2. Drop existing moderator policies that cause recursion
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view all preferences" ON public.preferences;
DROP POLICY IF EXISTS "Moderators can manage activities" ON public.activities;
DROP POLICY IF EXISTS "Moderators can manage allocations" ON public.allocations;

-- 3. Recreate policies using the security definer function
CREATE POLICY "Moderators can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_moderator(auth.uid()));

CREATE POLICY "Moderators can view all preferences"
ON public.preferences
FOR SELECT
USING (public.is_moderator(auth.uid()));

CREATE POLICY "Moderators can manage activities"
ON public.activities
FOR ALL
USING (public.is_moderator(auth.uid()));

CREATE POLICY "Moderators can manage allocations"
ON public.allocations
FOR ALL
USING (public.is_moderator(auth.uid()));

-- 4. Fix privilege escalation: Prevent users from updating their own role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 5. Fix database function security paths
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;