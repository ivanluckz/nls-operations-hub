-- Add policy for moderators and admins to view all preferences
CREATE POLICY "Moderators and admins can view all preferences" 
ON public.preferences 
FOR SELECT 
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));