-- Create attendance notifications table for absent/late/excused students
CREATE TABLE IF NOT EXISTS public.attendance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id uuid NOT NULL,
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('absent', 'late', 'excused')),
  notified_at timestamp with time zone DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  notes text
);

-- Enable RLS
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and mods can view all notifications"
ON public.attendance_notifications FOR SELECT
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Admins and mods can manage notifications"
ON public.attendance_notifications FOR ALL
USING (is_admin(auth.uid()) OR is_moderator(auth.uid()));

CREATE POLICY "Teachers can view notifications for their activities"
ON public.attendance_notifications FOR SELECT
USING (EXISTS (
  SELECT 1 FROM activities 
  WHERE activities.id = attendance_notifications.activity_id 
  AND activities.teacher_id = auth.uid()
));

-- Insert Umuganda Prep activity
INSERT INTO public.activities (
  title, 
  description, 
  category, 
  capacity, 
  schedule, 
  days_of_week, 
  teacher_in_charge, 
  created_by, 
  is_active
) VALUES (
  'Umuganda Prep',
  'Umuganda Prep prepares students for community service days by organizing tools, planning activities, and coordinating with local leaders to ensure impactful participation.',
  'Community engagement',
  30,
  '16:30 - 18:30',
  ARRAY['Wednesday'],
  'Teacher TBD',
  (SELECT id FROM profiles WHERE email LIKE '%@ntare-louisenlund.org' LIMIT 1),
  true
);

-- Create function to notify admins/mods of attendance issues
CREATE OR REPLACE FUNCTION public.create_attendance_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create notification for absent, late, or excused students
  IF NEW.status IN ('absent', 'late', 'excused') THEN
    INSERT INTO attendance_notifications (session_id, student_id, activity_id, status)
    SELECT 
      NEW.session_id,
      NEW.student_id,
      s.activity_id,
      NEW.status
    FROM attendance_sessions s
    WHERE s.id = NEW.session_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for attendance notifications
DROP TRIGGER IF EXISTS on_attendance_record_change ON attendance_records;
CREATE TRIGGER on_attendance_record_change
AFTER INSERT OR UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION create_attendance_notification();