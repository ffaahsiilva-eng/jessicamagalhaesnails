-- Create table to track 1-hour reminders and prevent duplicate messages
CREATE TABLE IF NOT EXISTS public.hour_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

GRANT SELECT, INSERT, DELETE ON public.hour_reminders_sent TO authenticated;
GRANT ALL ON public.hour_reminders_sent TO service_role;

ALTER TABLE public.hour_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage hour reminders" ON public.hour_reminders_sent;
CREATE POLICY "Admins manage hour reminders" ON public.hour_reminders_sent
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_hour_reminders_sent_appt ON public.hour_reminders_sent(appointment_id);

-- Enable pg_cron and pg_net if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: Daily summary to admin at 07:00 AM (BRT, UTC-3 -> 10:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('resumo-diario-agenda-07h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resumo-diario-agenda-07h');
    PERFORM cron.schedule(
      'resumo-diario-agenda-07h',
      '0 10 * * *',
      $cron$
      SELECT
        net.http_post(
          url:='https://ezpvzzazvhvjrzseaomg.supabase.co/functions/v1/daily-appointments-summary',
          headers:='{"Content-Type": "application/json"}'::jsonb,
          body:='{}'::jsonb
        ) as request_id;
      $cron$
    );

    -- Schedule: 1-hour appointment reminder (every 10 minutes from 08:00 to 20:00 BRT -> 11:00 to 23:00 UTC)
    PERFORM cron.unschedule('lembrete-1h-antes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lembrete-1h-antes');
    PERFORM cron.schedule(
      'lembrete-1h-antes',
      '*/10 11-23 * * *',
      $cron$
      SELECT
        net.http_post(
          url:='https://ezpvzzazvhvjrzseaomg.supabase.co/functions/v1/appointment-hour-reminder',
          headers:='{"Content-Type": "application/json"}'::jsonb,
          body:='{}'::jsonb
        ) as request_id;
      $cron$
    );
  END IF;
END $$;


