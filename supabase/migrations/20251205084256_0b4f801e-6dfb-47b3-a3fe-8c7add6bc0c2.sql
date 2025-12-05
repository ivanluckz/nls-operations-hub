-- Update handle_new_user to remove auto-moderator roles for Stacy, Patrick, Sakshi
-- Now only Jes'ka Washington gets auto-admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_teacher boolean;
  user_full_name text;
BEGIN
  user_full_name := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')));
  
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Check for admin user
  IF user_full_name = 'jes''ka washington' OR user_full_name = 'jeska washington' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;
  
  -- Check if this user's name matches any teacher_in_charge in activities
  SELECT EXISTS (
    SELECT 1 FROM public.activities 
    WHERE LOWER(teacher_in_charge) = user_full_name
  ) INTO is_teacher;
  
  -- Assign teacher role and link to activities
  IF is_teacher THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'teacher');
    
    -- Update activities to link teacher_id
    UPDATE public.activities
    SET teacher_id = NEW.id
    WHERE LOWER(teacher_in_charge) = user_full_name;
  ELSE
    -- Default to student role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student');
  END IF;
  
  RETURN NEW;
END;
$$;