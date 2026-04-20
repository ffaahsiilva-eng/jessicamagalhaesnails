
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;

DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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
    AND status <> 'cancelled';
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
