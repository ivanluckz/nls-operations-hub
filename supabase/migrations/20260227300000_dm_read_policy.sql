-- Allow DM participants to mark messages as read (update read_at).
-- Without this policy the read_at update in DirectMessages.tsx silently fails
-- because there was no UPDATE policy on direct_messages.
CREATE POLICY "DM participants can mark messages as read"
  ON public.direct_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_channels
      WHERE id = channel_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  )
  WITH CHECK (true);
