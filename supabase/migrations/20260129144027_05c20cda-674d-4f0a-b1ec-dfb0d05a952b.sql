-- Enable pg_net for HTTP calls (pg_cron is already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the overdue calls function to run daily at 12:00 UTC (14:00 Israel winter time)
SELECT cron.schedule(
  'process-overdue-calls-daily-14',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://qifcynwnxmtoxzpskmmt.supabase.co/functions/v1/process-overdue-calls',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZmN5bndueG10b3h6cHNrbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzOTQ1MDUsImV4cCI6MjA4NDk3MDUwNX0.LvK5rUyTpe9e4DSHp6DkC66LJUfu-3J---zlSl3QWIo'
    ),
    body:='{}'::jsonb
  );
  $$
);