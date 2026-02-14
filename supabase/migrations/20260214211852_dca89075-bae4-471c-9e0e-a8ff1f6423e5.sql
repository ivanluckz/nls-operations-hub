-- Add js_url column for optional animation scripts
ALTER TABLE public.user_themes ADD COLUMN js_url text DEFAULT NULL;