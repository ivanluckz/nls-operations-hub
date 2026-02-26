-- Badge requests: students request badges, admins approve/reject
CREATE TABLE IF NOT EXISTS public.badge_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User badges: awarded badges shown in chat
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_name TEXT NOT NULL,
  awarded_by UUID REFERENCES auth.users(id),
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_name)
);

ALTER TABLE public.badge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Students can submit and view their own requests
CREATE POLICY "Students can create badge requests"
  ON public.badge_requests FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view own badge requests"
  ON public.badge_requests FOR SELECT
  USING (auth.uid() = student_id);

-- Admins/moderators can view and update all requests
CREATE POLICY "Admins can view all badge requests"
  ON public.badge_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

CREATE POLICY "Admins can update badge requests"
  ON public.badge_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

-- Everyone can view badges (needed to display in chat)
CREATE POLICY "Anyone can view badges"
  ON public.user_badges FOR SELECT
  USING (true);

-- Admins can award badges
CREATE POLICY "Admins can award badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));

-- Admins can revoke badges
CREATE POLICY "Admins can revoke badges"
  ON public.user_badges FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  ));
