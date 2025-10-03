-- Drop the insecure view
DROP VIEW IF EXISTS teacher_students;

-- Create a secure function instead that checks authorization
CREATE OR REPLACE FUNCTION get_teacher_students(teacher_user_id UUID)
RETURNS TABLE (
  teacher_id UUID,
  activity_id UUID,
  activity_title TEXT,
  day_of_week TEXT,
  student_id UUID,
  student_name TEXT,
  student_email TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return data if the requesting user is the teacher OR is an admin/moderator
  SELECT 
    a.teacher_id,
    a.id AS activity_id,
    a.title AS activity_title,
    a.day_of_week,
    p.id AS student_id,
    p.full_name AS student_name,
    p.email AS student_email
  FROM activities a
  JOIN allocations al ON al.activity_id = a.id AND al.day_of_week = a.day_of_week
  JOIN profiles p ON p.id = al.student_id
  WHERE a.teacher_id = teacher_user_id
    AND (
      auth.uid() = teacher_user_id  -- User is the teacher
      OR is_admin(auth.uid())       -- User is admin
      OR is_moderator(auth.uid())   -- User is moderator
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_teacher_students(UUID) TO authenticated;