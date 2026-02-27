-- Direct message channels (one row per unique user pair)
CREATE TABLE public.dm_channels (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure each pair only has one channel (order-independent)
CREATE UNIQUE INDEX dm_channels_unique_pair
  ON public.dm_channels (
    LEAST(user1_id::text, user2_id::text),
    GREATEST(user1_id::text, user2_id::text)
  );

ALTER TABLE public.dm_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM participants can view their channels"
  ON public.dm_channels FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create DM channels"
  ON public.dm_channels FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Direct messages within a channel
CREATE TABLE public.direct_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.dm_channels(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at    TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM participants can view messages"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_channels
      WHERE id = channel_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "DM participants can send messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.dm_channels
      WHERE id = channel_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "Senders can delete own messages"
  ON public.direct_messages FOR DELETE
  USING (auth.uid() = sender_id);
