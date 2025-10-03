-- Change day_of_week from single TEXT to array of days
ALTER TABLE public.activities
DROP COLUMN day_of_week;

ALTER TABLE public.activities
ADD COLUMN days_of_week TEXT[] NOT NULL DEFAULT ARRAY['Monday']::TEXT[];

-- Update the enrollment trigger to work with array
CREATE OR REPLACE FUNCTION update_activity_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.activities
    SET current_enrollment = (
      SELECT COUNT(DISTINCT student_id)
      FROM public.allocations
      WHERE activity_id = NEW.activity_id
    )
    WHERE id = NEW.activity_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.activities
    SET current_enrollment = (
      SELECT COUNT(DISTINCT student_id)
      FROM public.allocations
      WHERE activity_id = OLD.activity_id
    )
    WHERE id = OLD.activity_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;