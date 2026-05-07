
CREATE OR REPLACE FUNCTION public.search_users_for_dm(_query text)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.banned = false
    AND p.id <> auth.uid()
    AND length(coalesce(_query,'')) >= 2
    AND p.full_name ILIKE ('%' || _query || '%')
  ORDER BY p.full_name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_users_for_dm(text) TO authenticated;
