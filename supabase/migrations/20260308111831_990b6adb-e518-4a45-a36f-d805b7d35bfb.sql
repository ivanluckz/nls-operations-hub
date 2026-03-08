-- Create meal_attendance table
CREATE TABLE public.meal_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scanned_by uuid NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  meal_date date NOT NULL DEFAULT CURRENT_DATE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, meal_type, meal_date)
);

ALTER TABLE public.meal_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen staff can view meal records"
ON public.meal_attendance FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'kitchen_staff') OR is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Kitchen staff can insert meal records"
ON public.meal_attendance FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'kitchen_staff') AND scanned_by = auth.uid());

CREATE POLICY "Admins can manage meal records"
ON public.meal_attendance FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_kitchen_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'kitchen_staff'
  )
$$;

CREATE POLICY "Kitchen staff can view student profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_kitchen_staff(auth.uid()));