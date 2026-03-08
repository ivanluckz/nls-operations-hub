
-- Remove kitchen_staff from RLS policies that reference it

-- Update meal_attendance INSERT policy to remove kitchen_staff
DROP POLICY IF EXISTS "RL coaches and moderators can insert meal records" ON public.meal_attendance;
CREATE POLICY "RL coaches and moderators can insert meal records" ON public.meal_attendance
  FOR INSERT
  WITH CHECK (
    (is_rl_coach(auth.uid()) OR is_moderator(auth.uid()))
    AND (scanned_by = auth.uid())
  );

-- Update profiles SELECT policy for kitchen staff
DROP POLICY IF EXISTS "Kitchen staff can view student profiles" ON public.profiles;

-- Drop the is_kitchen_staff function
DROP FUNCTION IF EXISTS public.is_kitchen_staff(uuid);

-- Remove kitchen_staff from the app_role enum
-- First check if any users still have kitchen_staff role and migrate them to student
UPDATE public.user_roles SET role = 'student' WHERE role = 'kitchen_staff';

-- Now remove the enum value (requires recreating the enum)
-- Since PostgreSQL doesn't support DROP VALUE from enum directly,
-- we'll leave the enum value but it won't be used anywhere
