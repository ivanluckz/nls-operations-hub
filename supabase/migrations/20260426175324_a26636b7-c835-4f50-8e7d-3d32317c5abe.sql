
-- 1. Update has_role to filter banned users (consistent with is_admin/is_moderator etc.)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND p.banned = false
  )
$$;

-- 2. Restrict badge visibility to authenticated users (was public to anon)
DROP POLICY IF EXISTS "Anyone can view badges" ON public.user_badges;
CREATE POLICY "Authenticated users can view badges"
ON public.user_badges
FOR SELECT
TO authenticated
USING (true);

-- 3. Remove privilege-escalation path: Dev-badge holders awarding/revoking badges via policy
-- Admins/moderators retain badge management; trigger block_dev_badge_insert protects the Dev badge.
DROP POLICY IF EXISTS "Dev badge holders can award safe badges" ON public.user_badges;
DROP POLICY IF EXISTS "Dev badge holders can revoke badges they awarded" ON public.user_badges;

-- 4. Stop exposing profile emails to activity peers and to students viewing teachers.
-- Postgres RLS cannot filter columns, so we revoke direct column SELECT on email
-- for the authenticated role and provide a SECURITY DEFINER function for the
-- legitimate readers (self, admins, moderators).
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;
GRANT SELECT (email) ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_profile_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email
  FROM public.profiles
  WHERE id = _user_id
    AND (
      auth.uid() = _user_id
      OR public.is_admin(auth.uid())
      OR public.is_moderator(auth.uid())
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_emails(_user_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND (
      public.is_admin(auth.uid())
      OR public.is_moderator(auth.uid())
      OR p.id = auth.uid()
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_emails(uuid[]) TO authenticated;
