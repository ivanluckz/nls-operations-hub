
CREATE OR REPLACE FUNCTION public.block_dev_badge_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.badge_name = 'Dev' THEN
    RAISE EXCEPTION 'Dev badge cannot be granted. It is permanently locked.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_dev_badge_insert
BEFORE INSERT ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION public.block_dev_badge_insert();
