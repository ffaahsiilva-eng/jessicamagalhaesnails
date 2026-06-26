
-- Lock down user_roles inserts to admins only (explicit restrictive policy)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Restrictive policy guarantees no permissive policy can ever let a non-admin write
CREATE POLICY "Restrict role writes to admins"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous booking flow to read blocked slots (date/time only) via the existing SECURITY DEFINER RPC.
-- Grant execute to anon so unauthenticated bookings can check availability without exposing the 'reason' column.
GRANT EXECUTE ON FUNCTION public.get_blocked_slots(date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon;
