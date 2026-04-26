-- Relax the Dev badge whitelist: allow any admin/moderator to grant it
CREATE OR REPLACE FUNCTION public.block_dev_badge_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Whitelist suppressed; admins/moderators may grant the Dev badge freely.
  -- (Self-award is still blocked by prevent_self_dev_badge.)
  RETURN NEW;
END;
$function$;