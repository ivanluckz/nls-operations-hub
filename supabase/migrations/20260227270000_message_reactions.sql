-- Message reactions (emoji reacts on activity_messages)
CREATE TABLE public.message_reactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID NOT NULL REFERENCES public.activity_messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (emoji IN ('👍','❤️','😂','🔥','👀','✅')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see reactions on messages they can access
CREATE POLICY "Authenticated users can view reactions"
  ON public.message_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can add their own reactions
CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);
