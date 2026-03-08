CREATE OR REPLACE FUNCTION public.count_allocated_students()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(DISTINCT student_id)::integer FROM public.allocations;
$$;