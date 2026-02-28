-- ============================================================
-- DM message editing: add edited_at column
-- ============================================================
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Fix UPDATE policies: replace the overly-broad one added in 20260227300000
-- with two scoped policies — one for editing own messages, one for read receipts.
DROP POLICY IF EXISTS "DM participants can mark messages as read" ON public.direct_messages;

-- Senders can edit their own messages (content + edited_at)
CREATE POLICY "Senders can edit own messages"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Participants can mark received messages as read (update read_at on others' messages)
CREATE POLICY "Participants can mark messages as read"
  ON public.direct_messages FOR UPDATE
  USING (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM public.dm_channels
      WHERE id = channel_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  )
  WITH CHECK (true);

-- ============================================================
-- DM message reactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (emoji IN ('👍','❤️','😂','🔥','👀','✅')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;

-- Both participants in the DM can see reactions
CREATE POLICY "DM participants can view reactions"
  ON public.dm_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      JOIN public.dm_channels ch ON ch.id = dm.channel_id
      WHERE dm.id = message_id
        AND (ch.user1_id = auth.uid() OR ch.user2_id = auth.uid())
    )
  );

-- Users can add their own reactions
CREATE POLICY "Users can add DM reactions"
  ON public.dm_message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      JOIN public.dm_channels ch ON ch.id = dm.channel_id
      WHERE dm.id = message_id
        AND (ch.user1_id = auth.uid() OR ch.user2_id = auth.uid())
    )
  );

-- Users can remove their own reactions
CREATE POLICY "Users can remove own DM reactions"
  ON public.dm_message_reactions FOR DELETE
  USING (auth.uid() = user_id);
