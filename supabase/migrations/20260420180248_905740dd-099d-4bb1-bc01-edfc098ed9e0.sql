-- Call sessions: one row per call (1-on-1 or group)
CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid NOT NULL,
  context_type text NOT NULL CHECK (context_type IN ('dm', 'activity')),
  dm_channel_id uuid REFERENCES public.dm_channels(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  call_type text NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT call_context_one_of CHECK (
    (context_type = 'dm' AND dm_channel_id IS NOT NULL AND activity_id IS NULL) OR
    (context_type = 'activity' AND activity_id IS NOT NULL AND dm_channel_id IS NULL)
  )
);

CREATE INDEX idx_call_sessions_dm ON public.call_sessions(dm_channel_id) WHERE dm_channel_id IS NOT NULL;
CREATE INDEX idx_call_sessions_activity ON public.call_sessions(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_call_sessions_status ON public.call_sessions(status);
CREATE INDEX idx_call_sessions_started ON public.call_sessions(started_at DESC);

-- Call participants: who joined which call
CREATE TABLE public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz,
  left_at timestamptz,
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, user_id)
);

CREATE INDEX idx_call_participants_call ON public.call_participants(call_id);
CREATE INDEX idx_call_participants_user ON public.call_participants(user_id);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Helper: can the user see this call?
CREATE OR REPLACE FUNCTION public.can_access_call(_call_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.call_sessions cs
    LEFT JOIN public.dm_channels ch ON ch.id = cs.dm_channel_id
    LEFT JOIN public.allocations al ON al.activity_id = cs.activity_id AND al.student_id = _user_id
    LEFT JOIN public.activities a ON a.id = cs.activity_id AND a.teacher_id = _user_id
    WHERE cs.id = _call_id
      AND (
        cs.initiator_id = _user_id
        OR (cs.context_type = 'dm' AND (ch.user1_id = _user_id OR ch.user2_id = _user_id))
        OR (cs.context_type = 'activity' AND (al.id IS NOT NULL OR a.id IS NOT NULL))
        OR EXISTS (SELECT 1 FROM public.call_participants cp WHERE cp.call_id = cs.id AND cp.user_id = _user_id)
        OR public.is_admin(_user_id)
        OR public.is_moderator(_user_id)
      )
  );
$$;

-- RLS for call_sessions
CREATE POLICY "Participants can view their calls"
ON public.call_sessions FOR SELECT
TO authenticated
USING (public.can_access_call(id, auth.uid()));

CREATE POLICY "Authenticated users can initiate calls"
ON public.call_sessions FOR INSERT
TO authenticated
WITH CHECK (
  initiator_id = auth.uid()
  AND (
    -- DM call: must be participant of the channel
    (context_type = 'dm' AND EXISTS (
      SELECT 1 FROM public.dm_channels ch
      WHERE ch.id = dm_channel_id AND (ch.user1_id = auth.uid() OR ch.user2_id = auth.uid())
    ))
    OR
    -- Activity call: must be allocated student or assigned teacher
    (context_type = 'activity' AND (
      EXISTS (SELECT 1 FROM public.allocations WHERE activity_id = call_sessions.activity_id AND student_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.activities WHERE id = call_sessions.activity_id AND teacher_id = auth.uid())
      OR public.is_admin(auth.uid())
      OR public.is_moderator(auth.uid())
    ))
  )
);

CREATE POLICY "Initiator or participants can update call status"
ON public.call_sessions FOR UPDATE
TO authenticated
USING (
  initiator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.call_participants WHERE call_id = call_sessions.id AND user_id = auth.uid())
);

-- RLS for call_participants
CREATE POLICY "Can view participants of accessible calls"
ON public.call_participants FOR SELECT
TO authenticated
USING (public.can_access_call(call_id, auth.uid()));

CREATE POLICY "Users can join accessible calls"
ON public.call_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_call(call_id, auth.uid())
);

CREATE POLICY "Initiator can invite participants"
ON public.call_participants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.call_sessions cs WHERE cs.id = call_id AND cs.initiator_id = auth.uid())
);

CREATE POLICY "Users can update own participation"
ON public.call_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
ALTER TABLE public.call_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;