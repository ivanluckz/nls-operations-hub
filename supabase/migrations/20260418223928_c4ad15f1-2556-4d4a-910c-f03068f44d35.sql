-- 1. Add banned check to is_moderator, is_medical, is_rl_coach
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = 'moderator' AND p.banned = false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_medical(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = 'medical' AND p.banned = false
  )
$$;

CREATE OR REPLACE FUNCTION public.is_rl_coach(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = 'rl_coach' AND p.banned = false
  )
$$;

-- 2. Lock down Dev badge holder grants — only allow specific safe badges, and only delete badges they awarded
DROP POLICY IF EXISTS "Dev badge holders can award badges" ON public.user_badges;
DROP POLICY IF EXISTS "Dev badge holders can revoke badges" ON public.user_badges;

CREATE POLICY "Dev badge holders can award safe badges"
ON public.user_badges FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = auth.uid() AND ub.badge_name = 'Dev')
  AND badge_name IN ('On Fire', 'Star Student', 'Champion', 'MVP', 'Rookie', 'Veteran', 'Helper', 'Mentor', 'Achiever')
  AND awarded_by = auth.uid()
);

CREATE POLICY "Dev badge holders can revoke badges they awarded"
ON public.user_badges FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.user_id = auth.uid() AND ub.badge_name = 'Dev')
  AND awarded_by = auth.uid()
  AND badge_name <> 'Dev'
);

-- 3. Require auth for admin profile/role visibility
DROP POLICY IF EXISTS "Anyone can view admin profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view admin profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'admin')
);

DROP POLICY IF EXISTS "Anyone can view admin roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view admin roles"
ON public.user_roles FOR SELECT
USING (auth.uid() IS NOT NULL AND role = 'admin');

-- 4. Remove sensitive medical/health tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.medical_visits;
ALTER PUBLICATION supabase_realtime DROP TABLE public.workout_clearances;
ALTER PUBLICATION supabase_realtime DROP TABLE public.workout_notifications;

-- 5. Add students' own SELECT on workout_attendance for consistency
CREATE POLICY "Students can view own workout attendance"
ON public.workout_attendance FOR SELECT
USING (auth.uid() = student_id);