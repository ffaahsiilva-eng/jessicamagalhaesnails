-- Create slot_holds table for temporary lock while client is in step-by-step
CREATE TABLE IF NOT EXISTS public.slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active slot holds" ON public.slot_holds;
CREATE POLICY "Anyone can view active slot holds"
ON public.slot_holds FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '15 minutes');

DROP POLICY IF EXISTS "Anyone can insert slot holds" ON public.slot_holds;
CREATE POLICY "Anyone can insert slot holds"
ON public.slot_holds FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete their slot holds" ON public.slot_holds;
CREATE POLICY "Anyone can delete their slot holds"
ON public.slot_holds FOR DELETE
TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_slot_holds_date_time ON public.slot_holds(slot_date, slot_time);

-- Update get_booked_slots to return both booked appointments and active holds
CREATE OR REPLACE FUNCTION public.get_booked_slots(_from_date date)
RETURNS TABLE(appointment_date date, appointment_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT appointment_date, appointment_time
  FROM public.appointments
  WHERE appointment_date >= _from_date
    AND status <> 'cancelled'
  UNION
  SELECT slot_date AS appointment_date, slot_time AS appointment_time
  FROM public.slot_holds
  WHERE slot_date >= _from_date
    AND created_at > now() - interval '15 minutes';
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
