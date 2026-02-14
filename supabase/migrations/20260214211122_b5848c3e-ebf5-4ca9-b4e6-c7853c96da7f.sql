-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Anyone can view themes" ON public.user_themes;

-- Users can see their own themes
CREATE POLICY "Users can view their own themes"
ON public.user_themes
FOR SELECT
USING (auth.uid() = user_id);

-- Admins and moderators can view all themes (for system themes)
CREATE POLICY "Admins and mods can view all themes"
ON public.user_themes
FOR SELECT
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));