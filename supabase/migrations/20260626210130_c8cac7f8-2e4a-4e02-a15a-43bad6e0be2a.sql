
CREATE TABLE public.maintenance_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

GRANT SELECT, INSERT, DELETE ON public.maintenance_reminders_sent TO authenticated;
GRANT ALL ON public.maintenance_reminders_sent TO service_role;

ALTER TABLE public.maintenance_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage maintenance reminders"
ON public.maintenance_reminders_sent
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_maintenance_reminders_sent_appt ON public.maintenance_reminders_sent(appointment_id);
