CREATE OR REPLACE FUNCTION public.validate_email_domain()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow specific whitelisted emails
  IF NEW.email = 'ivan.kundwa@gmail.com' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.email NOT LIKE '%@ntare-louisenlund.org' THEN
    RAISE EXCEPTION 'Only @ntare-louisenlund.org email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$function$;