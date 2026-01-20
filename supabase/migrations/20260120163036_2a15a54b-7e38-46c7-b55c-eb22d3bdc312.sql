-- Drop the incorrect unique constraint on student_id alone
ALTER TABLE public.allocations DROP CONSTRAINT allocations_student_id_key;