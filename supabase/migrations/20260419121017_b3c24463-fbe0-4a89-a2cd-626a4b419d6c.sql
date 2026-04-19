
-- ============================================================
-- 1. THEME MARKETPLACE
-- ============================================================
ALTER TABLE public.user_themes
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS install_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_themes_is_public ON public.user_themes(is_public) WHERE is_public = true;

CREATE POLICY "Anyone authenticated can view public themes"
ON public.user_themes
FOR SELECT
TO authenticated
USING (is_public = true);

-- ============================================================
-- 2. VOICE NOTES IN DMS
-- ============================================================
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

-- Allow content to be optional when audio is provided
ALTER TABLE public.direct_messages ALTER COLUMN content DROP NOT NULL;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder: voice-notes/<uid>/<file>
CREATE POLICY "Users upload own voice notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own voice notes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DM participants (and uploader) can read voice notes referenced in their channels
CREATE POLICY "DM participants can read voice notes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.direct_messages dm
      JOIN public.dm_channels ch ON ch.id = dm.channel_id
      WHERE dm.audio_url LIKE '%' || name || '%'
        AND (ch.user1_id = auth.uid() OR ch.user2_id = auth.uid())
    )
  )
);

-- ============================================================
-- 3. MENTIONS IN ACTIVITY CHANNELS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.activity_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_mentions_user_unread
  ON public.activity_mentions(mentioned_user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activity_mentions_activity ON public.activity_mentions(activity_id);

ALTER TABLE public.activity_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentioned users can view own mentions"
ON public.activity_mentions FOR SELECT
TO authenticated
USING (auth.uid() = mentioned_user_id);

CREATE POLICY "Senders can view mentions in own messages"
ON public.activity_mentions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.activity_messages m
    WHERE m.id = activity_mentions.message_id AND m.sender_id = auth.uid()
  )
);

CREATE POLICY "Senders can create mentions for own messages"
ON public.activity_mentions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.activity_messages m
    WHERE m.id = activity_mentions.message_id AND m.sender_id = auth.uid()
  )
);

CREATE POLICY "Mentioned users can mark mentions read"
ON public.activity_mentions FOR UPDATE
TO authenticated
USING (auth.uid() = mentioned_user_id)
WITH CHECK (auth.uid() = mentioned_user_id);
