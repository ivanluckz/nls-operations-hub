-- Allow moderators to insert meal attendance records (for lunch scanning)
DROP POLICY IF EXISTS "RL coaches can insert meal records" ON public.meal_attendance;

CREATE POLICY "RL coaches and moderators can insert meal records" ON public.meal_attendance
  FOR INSERT
  WITH CHECK (
    (is_rl_coach(auth.uid()) OR is_moderator(auth.uid()) OR has_role(auth.uid(), 'kitchen_staff'::app_role))
    AND (scanned_by = auth.uid())
  );

-- Allow moderators to view meal records
DROP POLICY IF EXISTS "RL coaches and admins can view meal records" ON public.meal_attendance;

CREATE POLICY "RL coaches admins and moderators can view meal records" ON public.meal_attendance
  FOR SELECT
  USING (is_rl_coach(auth.uid()) OR is_admin(auth.uid()) OR is_moderator(auth.uid()));