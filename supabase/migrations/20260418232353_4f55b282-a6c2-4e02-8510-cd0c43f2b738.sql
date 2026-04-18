-- Push subscriptions table for web push notifications
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- Service role policy for the send-push edge function to read all subscriptions
CREATE POLICY "Service role can read all subscriptions"
ON public.push_subscriptions FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role can delete stale subscriptions"
ON public.push_subscriptions FOR DELETE
TO service_role
USING (true);

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger function to call send-push edge function on new DM
CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
BEGIN
  -- Find recipient (the other participant in the channel)
  SELECT CASE WHEN ch.user1_id = NEW.sender_id THEN ch.user2_id ELSE ch.user1_id END
  INTO v_recipient_id
  FROM public.dm_channels ch
  WHERE ch.id = NEW.channel_id;

  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT full_name INTO v_sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  -- Async HTTP call to send-push edge function
  PERFORM net.http_post(
    url := 'https://nbjoqsaeulvwxlnbevog.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'recipient_id', v_recipient_id,
      'title', COALESCE(v_sender_name, 'New message'),
      'body', LEFT(NEW.content, 140),
      'url', '/student/messages',
      'tag', 'dm-' || NEW.channel_id::text
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if push fails
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_direct_message_push
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_direct_message();