
-- 1. Drop the overly broad authenticated profiles SELECT policy.
-- Scoped policies remain: own profile, activity peers, teacher profiles, admin profiles, admins/mods view all.
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- 2. Restrict workout_attendance broad teacher SELECT — keep only assignment-scoped policy.
DROP POLICY IF EXISTS "Teachers can view workout records" ON public.workout_attendance;

-- 3. Prevent users from self-awarding the 'Dev' badge (or any badge to themselves) via the
--    "Dev badge holders can award safe badges" path. We add a hard guard via trigger.
CREATE OR REPLACE FUNCTION public.prevent_self_dev_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block any attempt to self-award the Dev badge regardless of policy path
  IF NEW.badge_name = 'Dev' AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Users cannot award the Dev badge to themselves';
  END IF;
  -- Block any user from inserting a Dev badge unless they are an admin/moderator
  -- (the existing block_dev_badge_insert trigger restricts to whitelist; this adds defense in depth)
  IF NEW.badge_name = 'Dev' AND NOT (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins or moderators can grant the Dev badge';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_dev_badge_trigger ON public.user_badges;
CREATE TRIGGER prevent_self_dev_badge_trigger
  BEFORE INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_dev_badge();
