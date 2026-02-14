-- Add foreign key from attendance_notifications.student_id to profiles.id
ALTER TABLE public.attendance_notifications
ADD CONSTRAINT attendance_notifications_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(id);

-- Add foreign key from attendance_records.student_id to profiles.id
ALTER TABLE public.attendance_records
ADD CONSTRAINT attendance_records_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(id);