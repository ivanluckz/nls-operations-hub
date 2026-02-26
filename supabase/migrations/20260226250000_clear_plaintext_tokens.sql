-- Clear existing plaintext OAuth tokens.
-- After deploying the updated google-calendar-sync function (which now encrypts tokens),
-- any previously stored plaintext tokens would cause decryption failures.
-- Users will need to reconnect their Google Calendar once after this migration.
TRUNCATE TABLE public.google_calendar_tokens;
