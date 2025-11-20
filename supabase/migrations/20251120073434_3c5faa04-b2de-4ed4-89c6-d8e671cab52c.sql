-- =====================================================
-- CRITICAL SECURITY FIX: Separate roles from profiles
-- =====================================================

-- Step 1: Drop policies that will be affected by function changes
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators and admins can manage activities" ON public.activities;
DROP POLICY IF EXISTS "Moderators and admins can manage allocations" ON public.allocations;
DROP POLICY IF EXISTS "Moderators and admins can view all sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Moderators and admins can view all records" ON public.attendance_records;

-- Step 2: Drop existing functions with CASCADE
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_moderator(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_teacher_students(uuid) CASCADE;

-- Step 3: Create app_role enum
CREATE TYPE public.app_role AS ENUM ('student', 'moderator', 'admin', 'teacher');

-- Step 4: Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::text::app_role
FROM public.profiles;

-- Step 6: Drop role column from profiles (after data migration)
ALTER TABLE public.profiles DROP COLUMN role CASCADE;

-- Step 7: Create has_role() function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 8: Create is_admin() using user_roles
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.role = 'admin'
      AND p.banned = false
  )
$$;

-- Step 9: Create is_moderator() using user_roles
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'moderator'
  )
$$;

-- Step 10: Create get_teacher_students() using has_role()
CREATE OR REPLACE FUNCTION public.get_teacher_students(teacher_user_id uuid)
RETURNS TABLE(
  teacher_id uuid,
  activity_id uuid,
  activity_title text,
  day_of_week text,
  student_id uuid,
  student_name text,
  student_email text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.teacher_id,
    a.id AS activity_id,
    a.title AS activity_title,
    al.day_of_week,
    p.id AS student_id,
    p.full_name AS student_name,
    p.email AS student_email
  FROM activities a
  JOIN allocations al ON al.activity_id = a.id
  JOIN profiles p ON p.id = al.student_id
  WHERE a.teacher_id = teacher_user_id
    AND (
      auth.uid() = teacher_user_id
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'moderator')
    )
$$;

-- Step 11: Recreate profiles policies without role dependency
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- Step 12: Recreate other policies
CREATE POLICY "Moderators and admins can manage activities"
ON public.activities FOR ALL
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can manage allocations"
ON public.allocations FOR ALL
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can view all sessions"
ON public.attendance_sessions FOR SELECT
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Moderators and admins can view all records"
ON public.attendance_records FOR SELECT
USING (is_moderator(auth.uid()) OR is_admin(auth.uid()));

-- Step 13: Add RLS policies to user_roles table
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Step 14: Update handle_new_user() trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

-- Step 15: Add indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Step 16: Add updated_at trigger
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();