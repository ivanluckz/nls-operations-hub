
-- Add cached like_count on user_themes
ALTER TABLE public.user_themes
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_themes_like_count
  ON public.user_themes(like_count DESC) WHERE is_public = true;

-- Likes table
CREATE TABLE IF NOT EXISTS public.theme_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.user_themes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (theme_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_likes_theme ON public.theme_likes(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_likes_user  ON public.theme_likes(user_id);

ALTER TABLE public.theme_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes on public themes"
ON public.theme_likes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_themes ut
    WHERE ut.id = theme_likes.theme_id AND (ut.is_public = true OR ut.user_id = auth.uid())
  )
);

CREATE POLICY "Users can like public themes"
ON public.theme_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.user_themes ut WHERE ut.id = theme_id AND ut.is_public = true)
);

CREATE POLICY "Users can remove own likes"
ON public.theme_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger to keep like_count in sync
CREATE OR REPLACE FUNCTION public.sync_theme_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_themes SET like_count = like_count + 1 WHERE id = NEW.theme_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_themes SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.theme_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_theme_likes_count ON public.theme_likes;
CREATE TRIGGER trg_theme_likes_count
AFTER INSERT OR DELETE ON public.theme_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_theme_like_count();

-- Safe install-count bumper (any authenticated user can increment a public theme's counter)
CREATE OR REPLACE FUNCTION public.bump_theme_install_count(_theme_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_themes
  SET install_count = install_count + 1
  WHERE id = _theme_id AND is_public = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_theme_install_count(uuid) TO authenticated;
