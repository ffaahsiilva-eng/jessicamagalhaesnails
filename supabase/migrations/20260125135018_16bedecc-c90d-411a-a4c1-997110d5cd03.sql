-- Create services table for price management
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  duration TEXT NOT NULL,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Everyone can view active services
CREATE POLICY "Anyone can view active services"
ON public.services
FOR SELECT
USING (is_active = true);

-- Only admins can manage services
CREATE POLICY "Admins can manage services"
ON public.services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services
INSERT INTO public.services (name, description, price, duration, is_popular, display_order) VALUES
('Manicure Simples', 'Esmaltação tradicional com cutilagem', 'R$ 35', '45 min', false, 1),
('Manicure com Francesinha', 'Clássica francesinha com acabamento perfeito', 'R$ 45', '1h', false, 2),
('Alongamento em Gel', 'Unhas alongadas com gel moldado', 'R$ 120', '2h', true, 3),
('Esmaltação em Gel', 'Durabilidade de até 3 semanas', 'R$ 80', '1h30', true, 4),
('Nail Art Simples', 'Decoração artística por unha', 'R$ 5', '+10 min', false, 5),
('Nail Art Elaborada', 'Design exclusivo e detalhado', 'R$ 15', '+20 min', false, 6),
('Banho de Gel', 'Fortalecimento e brilho intenso', 'R$ 60', '1h', false, 7),
('Pedicure Completa', 'Cutilagem, esfoliação e esmaltação', 'R$ 50', '1h', false, 8);