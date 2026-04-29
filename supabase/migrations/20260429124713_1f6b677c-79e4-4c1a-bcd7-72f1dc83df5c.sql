
CREATE TABLE IF NOT EXISTS public.integration_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read integration settings"
  ON public.integration_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_moderator(auth.uid()));

CREATE POLICY "Admins write integration settings"
  ON public.integration_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update integration settings"
  ON public.integration_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.integration_settings (key, value) VALUES
  ('gsheet_workouts_id', NULL),
  ('gsheet_activities_id', NULL)
ON CONFLICT (key) DO NOTHING;
