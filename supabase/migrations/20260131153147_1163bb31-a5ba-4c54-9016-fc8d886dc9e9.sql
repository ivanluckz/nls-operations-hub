-- Fix the profiles table SELECT policy to remove redundant check
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate with simplified, secure condition
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);