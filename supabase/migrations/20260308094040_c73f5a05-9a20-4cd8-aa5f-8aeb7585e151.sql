DROP POLICY IF EXISTS "Participants can mark messages as read" ON public.direct_messages;

CREATE POLICY "Participants can mark messages as read"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (
  (auth.uid() <> sender_id) AND (EXISTS (
    SELECT 1 FROM dm_channels
    WHERE dm_channels.id = direct_messages.channel_id
    AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
  ))
)
WITH CHECK (
  (auth.uid() <> sender_id) AND (EXISTS (
    SELECT 1 FROM dm_channels
    WHERE dm_channels.id = direct_messages.channel_id
    AND (dm_channels.user1_id = auth.uid() OR dm_channels.user2_id = auth.uid())
  ))
);