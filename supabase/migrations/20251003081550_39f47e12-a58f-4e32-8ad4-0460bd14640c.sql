-- Add 'teacher' role to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';

-- Add day_of_week and teacher_id columns to activities table
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS day_of_week TEXT NOT NULL DEFAULT 'Monday',
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add day_of_week column to allocations table
ALTER TABLE public.allocations
ADD COLUMN IF NOT EXISTS day_of_week TEXT NOT NULL DEFAULT 'Monday';

-- Drop the old preferences table and recreate with new structure
DROP TABLE IF EXISTS public.preferences CASCADE;

CREATE TABLE public.preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monday_first_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  monday_second_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  monday_third_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  tuesday_first_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  tuesday_second_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  tuesday_third_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  wednesday_first_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  wednesday_second_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  wednesday_third_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  thursday_first_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  thursday_second_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  thursday_third_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  friday_first_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  friday_second_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  friday_third_choice UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Enable RLS on preferences
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for preferences
CREATE POLICY "Students can view their own preferences"
ON public.preferences FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own preferences"
ON public.preferences FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own preferences"
ON public.preferences FOR UPDATE
USING (auth.uid() = student_id);

CREATE POLICY "Moderators can view all preferences"
ON public.preferences FOR SELECT
USING (is_moderator(auth.uid()));

-- Update activities RLS policies to include admins
DROP POLICY IF EXISTS "Moderators can manage activities" ON public.activities;
CREATE POLICY "Moderators and admins can manage activities"
ON public.activities FOR ALL
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- Update allocations RLS policies to include admins
DROP POLICY IF EXISTS "Moderators can manage allocations" ON public.allocations;
CREATE POLICY "Moderators and admins can manage allocations"
ON public.allocations FOR ALL
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- Create function to update activity enrollment count
CREATE OR REPLACE FUNCTION update_activity_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.activities
    SET current_enrollment = (
      SELECT COUNT(*)
      FROM public.allocations
      WHERE activity_id = NEW.activity_id AND day_of_week = NEW.day_of_week
    )
    WHERE id = NEW.activity_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.activities
    SET current_enrollment = (
      SELECT COUNT(*)
      FROM public.allocations
      WHERE activity_id = OLD.activity_id AND day_of_week = OLD.day_of_week
    )
    WHERE id = OLD.activity_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic enrollment count updates
DROP TRIGGER IF EXISTS update_enrollment_count ON public.allocations;
CREATE TRIGGER update_enrollment_count
AFTER INSERT OR DELETE ON public.allocations
FOR EACH ROW EXECUTE FUNCTION update_activity_enrollment();

-- Create teacher_students view for teachers to see their students
CREATE OR REPLACE VIEW teacher_students AS
SELECT 
  a.teacher_id,
  a.id AS activity_id,
  a.title AS activity_title,
  a.day_of_week,
  p.id AS student_id,
  p.full_name AS student_name,
  p.email AS student_email
FROM public.activities a
JOIN public.allocations al ON al.activity_id = a.id AND al.day_of_week = a.day_of_week
JOIN public.profiles p ON p.id = al.student_id
WHERE a.teacher_id IS NOT NULL;