-- Enable pg_cron and pg_net extensions (run once if not already enabled)
-- These may already be enabled in your Supabase project dashboard.
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;

-- Schedule auto-mark-absent to run every 15 minutes
-- Replace <YOUR_SUPABASE_URL> with your actual project URL (e.g. https://xyz.supabase.co)
-- Replace <YOUR_SERVICE_ROLE_KEY> with your service role key (Settings → API → service_role)

select cron.schedule(
  'auto-mark-absent',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<YOUR_SUPABASE_URL>/functions/v1/auto-mark-absent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check scheduled jobs:  select * from cron.job;
-- To remove this job:       select cron.unschedule('auto-mark-absent');
