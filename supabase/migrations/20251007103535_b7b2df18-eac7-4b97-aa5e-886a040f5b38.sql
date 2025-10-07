-- Extend preferences to 5 choices and add Wednesday Slot 2
-- Drop existing preference columns for Wednesday and add slot-based columns
ALTER TABLE public.preferences
  DROP COLUMN IF EXISTS wednesday_first_choice,
  DROP COLUMN IF EXISTS wednesday_second_choice,
  DROP COLUMN IF EXISTS wednesday_third_choice;

-- Add 4th and 5th choices for Monday, Tuesday, Thursday, Friday
ALTER TABLE public.preferences
  ADD COLUMN monday_fourth_choice uuid,
  ADD COLUMN monday_fifth_choice uuid,
  ADD COLUMN tuesday_fourth_choice uuid,
  ADD COLUMN tuesday_fifth_choice uuid,
  ADD COLUMN thursday_fourth_choice uuid,
  ADD COLUMN thursday_fifth_choice uuid,
  ADD COLUMN friday_fourth_choice uuid,
  ADD COLUMN friday_fifth_choice uuid;

-- Add Wednesday Slot 1 (5 choices)
ALTER TABLE public.preferences
  ADD COLUMN wednesday_slot1_first_choice uuid,
  ADD COLUMN wednesday_slot1_second_choice uuid,
  ADD COLUMN wednesday_slot1_third_choice uuid,
  ADD COLUMN wednesday_slot1_fourth_choice uuid,
  ADD COLUMN wednesday_slot1_fifth_choice uuid;

-- Add Wednesday Slot 2 (5 choices)
ALTER TABLE public.preferences
  ADD COLUMN wednesday_slot2_first_choice uuid,
  ADD COLUMN wednesday_slot2_second_choice uuid,
  ADD COLUMN wednesday_slot2_third_choice uuid,
  ADD COLUMN wednesday_slot2_fourth_choice uuid,
  ADD COLUMN wednesday_slot2_fifth_choice uuid;

-- Add slot_number to allocations table
ALTER TABLE public.allocations
  ADD COLUMN slot_number integer DEFAULT 1 NOT NULL;

-- Update the unique constraint to include slot_number
ALTER TABLE public.allocations
  DROP CONSTRAINT IF EXISTS allocations_pkey;

ALTER TABLE public.allocations
  ADD PRIMARY KEY (id);

-- Add unique constraint for student, day, and slot
ALTER TABLE public.allocations
  ADD CONSTRAINT allocations_student_day_slot_unique 
  UNIQUE (student_id, day_of_week, slot_number);

-- Create function to validate email domain
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@ntare-louisenlund.org' THEN
    RAISE EXCEPTION 'Only @ntare-louisenlund.org email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to validate email on profile creation
DROP TRIGGER IF EXISTS validate_email_domain_trigger ON public.profiles;
CREATE TRIGGER validate_email_domain_trigger
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_email_domain();