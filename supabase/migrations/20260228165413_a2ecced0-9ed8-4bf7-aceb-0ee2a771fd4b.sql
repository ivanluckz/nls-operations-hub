
-- Allow Dev badge holders to grant badges
CREATE POLICY "Dev badge holders can award badges"
ON public.user_badges
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = auth.uid() AND ub.badge_name = 'Dev'
  )
);

-- Allow Dev badge holders to revoke badges
CREATE POLICY "Dev badge holders can revoke badges"
ON public.user_badges
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = auth.uid() AND ub.badge_name = 'Dev'
  )
);
