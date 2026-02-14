
-- Create themes table
CREATE TABLE public.user_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  css_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;

-- Users can view all themes (shared gallery)
CREATE POLICY "Anyone can view themes"
ON public.user_themes FOR SELECT
TO authenticated
USING (true);

-- Users can create their own themes
CREATE POLICY "Users can create their own themes"
ON public.user_themes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own themes
CREATE POLICY "Users can update their own themes"
ON public.user_themes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own themes
CREATE POLICY "Users can delete their own themes"
ON public.user_themes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_themes_updated_at
BEFORE UPDATE ON public.user_themes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for theme CSS files
INSERT INTO storage.buckets (id, name, public) VALUES ('themes', 'themes', true);

-- Storage policies for theme files
CREATE POLICY "Anyone can view theme files"
ON storage.objects FOR SELECT
USING (bucket_id = 'themes');

CREATE POLICY "Users can upload their own theme files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'themes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own theme files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'themes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own theme files"
ON storage.objects FOR DELETE
USING (bucket_id = 'themes' AND auth.uid()::text = (storage.foldername(name))[1]);
