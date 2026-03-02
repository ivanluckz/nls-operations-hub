
-- Drop all academic-related tables (respecting FK dependencies)
DROP TABLE IF EXISTS public.academic_attendance CASCADE;
DROP TABLE IF EXISTS public.academic_excuses CASCADE;
DROP TABLE IF EXISTS public.academic_messages CASCADE;
DROP TABLE IF EXISTS public.academic_sessions CASCADE;
DROP TABLE IF EXISTS public.timetable_enrollments CASCADE;
DROP TABLE IF EXISTS public.class_group_members CASCADE;
DROP TABLE IF EXISTS public.timetable_slots CASCADE;
DROP TABLE IF EXISTS public.academic_subjects CASCADE;
DROP TABLE IF EXISTS public.class_groups CASCADE;
DROP TABLE IF EXISTS public.academic_periods CASCADE;
