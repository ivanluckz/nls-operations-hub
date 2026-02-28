-- Drop and recreate trigger with ivan.kundwa30 added to whitelist
DROP TRIGGER IF EXISTS prevent_dev_badge_insert ON public.user_badges;

CREATE OR REPLACE FUNCTION public.block_dev_badge_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.badge_name = 'Dev' THEN
    IF NEW.user_id NOT IN (
      'ba27755a-5cee-4b59-827a-b9e2d1b18f22', -- ivan.kundwa@gmail.com
      '3f50b5f7-5001-4200-bdaf-05d692b97510', -- ivan.kundwa30@ntare-louisenlund.org
      '76aff810-f447-4cff-807c-debcd7c7bdea', -- blaise.imanzi30@ntare-louisenlund.org
      'edad28ad-b301-4885-9129-3636d7e82978', -- ian.ngoga30@ntare-louisenlund.org
      '217a2e3c-ebe7-4225-801e-073dec8f9f56'  -- roli.byishimo30@ntare-louisenlund.org
    ) THEN
      RAISE EXCEPTION 'Dev badge cannot be granted. It is permanently locked.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_dev_badge_insert
  BEFORE INSERT ON public.user_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.block_dev_badge_insert();