
-- 1) Fix anonymous insert binding on appointments
DROP POLICY IF EXISTS "Anyone can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

CREATE POLICY "Guests or owners can insert appointments"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NOT NULL AND user_id IS NULL)
);

-- 2) Restrict blocked_slots SELECT so created_by is not leaked publicly
DROP POLICY IF EXISTS "Anyone can view blocked slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "Public can view blocked slots" ON public.blocked_slots;

-- Secure function returns only date/time (no created_by) for public calendar
CREATE OR REPLACE FUNCTION public.get_blocked_slots(_from_date date)
RETURNS TABLE(blocked_date date, blocked_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT blocked_date, blocked_time
  FROM public.blocked_slots
  WHERE blocked_date >= _from_date;
$$;

-- Only admins can read raw blocked_slots rows (with created_by)
CREATE POLICY "Admins can view blocked slots"
ON public.blocked_slots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Update theme to terracotta
UPDATE public.site_settings SET value = '14'  WHERE key = 'theme_primary_h';
UPDATE public.site_settings SET value = '55'  WHERE key = 'theme_primary_s';
UPDATE public.site_settings SET value = '48'  WHERE key = 'theme_primary_l';
UPDATE public.site_settings SET value = '18'  WHERE key = 'theme_accent_h';
UPDATE public.site_settings SET value = '60'  WHERE key = 'theme_accent_s';
UPDATE public.site_settings SET value = '60'  WHERE key = 'theme_accent_l';
UPDATE public.site_settings SET value = '30'  WHERE key = 'theme_background_h';
UPDATE public.site_settings SET value = '25'  WHERE key = 'theme_background_s';
UPDATE public.site_settings SET value = '98'  WHERE key = 'theme_background_l';
