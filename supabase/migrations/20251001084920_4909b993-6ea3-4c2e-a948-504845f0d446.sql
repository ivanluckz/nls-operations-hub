-- Step 2: Create admin function and policies (after enum is committed)

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
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
      AND role = 'admin'::user_role
      AND banned = false
  );
$$;

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to update any profile (name, role, banned status)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to delete any profile
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_admin(auth.uid()));

-- Update existing moderator policy to also work for admins
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;
CREATE POLICY "Moderators and admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));