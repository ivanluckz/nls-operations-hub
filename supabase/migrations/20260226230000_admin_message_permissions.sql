-- Allow admins and moderators to send messages to any activity
CREATE POLICY "Admins can insert messages"
ON public.activity_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (is_admin(auth.uid()) OR is_moderator(auth.uid()))
);

-- Allow admins and moderators to delete any message
CREATE POLICY "Admins can delete any message"
ON public.activity_messages
FOR DELETE
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));
