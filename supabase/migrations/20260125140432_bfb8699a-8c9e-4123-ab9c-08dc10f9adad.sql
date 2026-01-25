-- Create site_settings table for editable content
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can view site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage site settings"
ON public.site_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
-- Contact info
('whatsapp_number', '559191837179', 'WhatsApp', 'text', 'contact'),
('instagram_url', 'https://instagram.com/glamournails', 'Instagram', 'text', 'contact'),
('facebook_url', 'https://facebook.com/glamournails', 'Facebook', 'text', 'contact'),
-- Hero section
('hero_title', 'Jéssica Magalhães', 'Título do Hero', 'text', 'hero'),
('hero_subtitle', 'Nail Designer', 'Subtítulo', 'text', 'hero'),
('hero_description', 'Transformando unhas em obras de arte com técnicas exclusivas e produtos de alta qualidade', 'Descrição', 'textarea', 'hero'),
('hero_image_url', '', 'Imagem do Hero', 'image', 'hero'),
-- Branding
('logo_url', '', 'Logo', 'image', 'branding'),
('site_name', 'Jéssica Magalhães', 'Nome do Site', 'text', 'branding');