-- Update the handle_new_user function to automatically assign teacher role
-- if their name matches a teacher_in_charge in activities
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_teacher boolean;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Check if this user's name matches any teacher_in_charge in activities
  SELECT EXISTS (
    SELECT 1 FROM public.activities 
    WHERE LOWER(teacher_in_charge) = LOWER(COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ) INTO is_teacher;
  
  -- Assign appropriate role
  IF is_teacher THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'teacher');
    
    -- Update activities to link teacher_id
    UPDATE public.activities
    SET teacher_id = NEW.id
    WHERE LOWER(teacher_in_charge) = LOWER(COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student');
  END IF;
  
  RETURN NEW;
END;
$function$;