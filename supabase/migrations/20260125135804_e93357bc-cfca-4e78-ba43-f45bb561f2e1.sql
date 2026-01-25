-- Create available_times table for admin to manage appointment slots
CREATE TABLE public.available_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_slot TIME NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.available_times ENABLE ROW LEVEL SECURITY;

-- Everyone can view active time slots
CREATE POLICY "Anyone can view active time slots"
ON public.available_times
FOR SELECT
USING (is_active = true);

-- Only admins can manage time slots
CREATE POLICY "Admins can manage time slots"
ON public.available_times
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default time slots
INSERT INTO public.available_times (time_slot, display_order) VALUES
('09:00', 1),
('10:00', 2),
('11:00', 3),
('14:00', 4),
('15:00', 5),
('16:00', 6),
('17:00', 7),
('18:00', 8);