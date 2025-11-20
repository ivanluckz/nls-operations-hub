-- Restrict activities to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active activities" ON public.activities;

CREATE POLICY "Authenticated users can view active activities"
ON public.activities FOR SELECT
TO authenticated
USING (is_active = true);