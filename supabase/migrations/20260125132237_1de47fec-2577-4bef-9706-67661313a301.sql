-- Allow anyone to insert appointments (for guest bookings)
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;

CREATE POLICY "Anyone can insert appointments"
ON public.appointments
FOR INSERT
WITH CHECK (true);