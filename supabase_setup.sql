-- File: 20260125035532_c0cd48da-5dc1-47b9-96f5-5ea3c5691279.sql
-- Create profiles table for client information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    service_type TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments (public can view available slots, users can manage their own)
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;
CREATE POLICY "Anyone can view appointments" ON public.appointments 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
CREATE POLICY "Users can update their own appointments" ON public.appointments 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;
CREATE POLICY "Users can delete their own appointments" ON public.appointments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- File: 20260125040836_9df3bdf0-4012-4a27-b07a-c5332a656d1f.sql
-- Criar enum para roles
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: Usuários podem ver suas próprias roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Apenas admins podem inserir roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Atualizar policies da tabela appointments para admins
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
CREATE POLICY "Admins can view all appointments" ON public.appointments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update any appointment" ON public.appointments;
CREATE POLICY "Admins can update any appointment" ON public.appointments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete any appointment" ON public.appointments;
CREATE POLICY "Admins can delete any appointment" ON public.appointments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- File: 20260125041520_2f5ebaff-7e39-4c44-96fc-92f93a083232.sql
-- Criar tabela para horários bloqueados
CREATE TABLE IF NOT EXISTS public.blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocked_date DATE NOT NULL,
    blocked_time TIME NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (blocked_date, blocked_time)
);

-- Habilitar RLS
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos podem ver bloqueios (para saber indisponibilidade)
DROP POLICY IF EXISTS "Anyone can view blocked slots" ON public.blocked_slots;
CREATE POLICY "Anyone can view blocked slots" ON public.blocked_slots
FOR SELECT
USING (true);

-- Apenas admins podem gerenciar bloqueios
DROP POLICY IF EXISTS "Admins can insert blocked slots" ON public.blocked_slots;
CREATE POLICY "Admins can insert blocked slots" ON public.blocked_slots
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete blocked slots" ON public.blocked_slots;
CREATE POLICY "Admins can delete blocked slots" ON public.blocked_slots
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- File: 20260125132237_1de47fec-2577-4bef-9706-67661313a301.sql
-- Allow anyone to insert appointments (for guest bookings)
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;

DROP POLICY IF EXISTS "Anyone can insert appointments" ON public.appointments;
CREATE POLICY "Anyone can insert appointments" ON public.appointments
FOR INSERT
WITH CHECK (true);

-- File: 20260125133429_a00c9ede-0bc8-4dcc-b49d-63360f4abc61.sql
-- Add email column to appointments table for reminders
ALTER TABLE public.appointments 
ADD COLUMN client_email text;

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- File: 20260125135018_16bedecc-c90d-411a-a4c1-997110d5cd03.sql
-- Create services table for price management
CREATE TABLE IF NOT EXISTS public.services (
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
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
CREATE POLICY "Anyone can view active services" ON public.services
FOR SELECT
USING (is_active = true);

-- Only admins can manage services
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services" ON public.services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
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

-- File: 20260125135332_1610e0e7-cb83-4778-ac6a-726678259ede.sql
-- Add image_url column to services table
ALTER TABLE public.services ADD COLUMN image_url TEXT;

-- Create storage bucket for service images
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for service images
CREATE POLICY "Anyone can view service images"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-images');

CREATE POLICY "Admins can upload service images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'service-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service images"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-images' AND has_role(auth.uid(), 'admin'::app_role));

-- File: 20260125135804_e93357bc-cfca-4e78-ba43-f45bb561f2e1.sql
-- Create available_times table for admin to manage appointment slots
CREATE TABLE IF NOT EXISTS public.available_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_slot TIME NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.available_times ENABLE ROW LEVEL SECURITY;

-- Everyone can view active time slots
DROP POLICY IF EXISTS "Anyone can view active time slots" ON public.available_times;
CREATE POLICY "Anyone can view active time slots" ON public.available_times
FOR SELECT
USING (is_active = true);

-- Only admins can manage time slots
DROP POLICY IF EXISTS "Admins can manage time slots" ON public.available_times;
CREATE POLICY "Admins can manage time slots" ON public.available_times
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

-- File: 20260125140110_c79bdf17-e156-490e-b413-e5cca652fb0b.sql
-- Create gallery_images table
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view active gallery images
DROP POLICY IF EXISTS "Anyone can view active gallery images" ON public.gallery_images;
CREATE POLICY "Anyone can view active gallery images" ON public.gallery_images
FOR SELECT
USING (is_active = true);

-- Only admins can manage gallery images
DROP POLICY IF EXISTS "Admins can manage gallery images" ON public.gallery_images;
CREATE POLICY "Admins can manage gallery images" ON public.gallery_images
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for gallery images
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-images', 'gallery-images', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for gallery images
CREATE POLICY "Anyone can view gallery images"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery-images');

CREATE POLICY "Admins can upload gallery images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gallery-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update gallery images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'gallery-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete gallery images"
ON storage.objects FOR DELETE
USING (bucket_id = 'gallery-images' AND has_role(auth.uid(), 'admin'::app_role));

-- File: 20260125140432_bfb8699a-8c9e-4123-ab9c-08dc10f9adad.sql
-- Create site_settings table for editable content
CREATE TABLE IF NOT EXISTS public.site_settings (
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
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings" ON public.site_settings
FOR SELECT
USING (true);

-- Only admins can manage settings
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings" ON public.site_settings
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

-- File: 20260125140833_7b2ec272-ee73-4ae1-8626-19d23896e3c4.sql
-- Add business hours settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
('business_hours_weekday', 'Seg-Sáb: 9h às 19h', 'Horário Semana', 'text', 'contact'),
('business_hours_note', 'Atendimento com hora marcada', 'Observação', 'text', 'contact') ON CONFLICT (key) DO NOTHING;

-- File: 20260125185507_cb014601-4dd7-42c1-9814-b9c7b883b1f6.sql
-- Insert theme color settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
  ('theme_primary_h', '350', 'Cor Primária (Matiz)', 'color', 'theme'),
  ('theme_primary_s', '60', 'Cor Primária (Saturação)', 'range', 'theme'),
  ('theme_primary_l', '65', 'Cor Primária (Luminosidade)', 'range', 'theme'),
  ('theme_accent_h', '15', 'Cor Destaque (Matiz)', 'color', 'theme'),
  ('theme_accent_s', '70', 'Cor Destaque (Saturação)', 'range', 'theme'),
  ('theme_accent_l', '75', 'Cor Destaque (Luminosidade)', 'range', 'theme'),
  ('theme_background_h', '20', 'Fundo (Matiz)', 'color', 'theme'),
  ('theme_background_s', '33', 'Fundo (Saturação)', 'range', 'theme'),
  ('theme_background_l', '98', 'Fundo (Luminosidade)', 'range', 'theme')
ON CONFLICT (key) DO NOTHING;

-- File: 20260125185920_d897da4f-9988-48e6-97d2-0f86b76a9c0e.sql
-- Insert font settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
  ('font_display', 'Cormorant Garamond', 'Fonte dos Títulos', 'select', 'fonts'),
  ('font_body', 'Montserrat', 'Fonte do Corpo', 'select', 'fonts')
ON CONFLICT (key) DO NOTHING;

-- File: 20260125190225_c60d0296-fb9b-4311-80d3-749444875f45.sql
-- Insert font size settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
  ('font_scale', '1', 'Escala de Fonte', 'range', 'fonts'),
  ('font_heading_size', 'normal', 'Tamanho dos Títulos', 'select', 'fonts'),
  ('font_body_size', 'normal', 'Tamanho do Corpo', 'select', 'fonts')
ON CONFLICT (key) DO NOTHING;

-- File: 20260225222547_0887f99f-0a13-4242-bf2f-b42f45b51739.sql
ALTER TABLE public.available_times ADD COLUMN day_type text NOT NULL DEFAULT 'weekday' CHECK (day_type IN ('weekday', 'weekend'));

-- File: 20260415122632_bb75b276-7014-46ed-a680-e57940940a5a.sql

-- Remove unique constraint on time_slot alone
ALTER TABLE available_times DROP CONSTRAINT available_times_time_slot_key;

-- Now the old check constraint was already dropped in the previous migration attempt
-- Check current state and drop if exists
ALTER TABLE available_times DROP CONSTRAINT IF EXISTS available_times_day_type_check;

-- Expand weekday into individual days
INSERT INTO available_times (time_slot, display_order, is_active, day_type)
SELECT time_slot, display_order, is_active, d.day
FROM available_times
CROSS JOIN (VALUES ('monday'),('tuesday'),('wednesday'),('thursday'),('friday')) AS d(day)
WHERE day_type = 'weekday';

-- Convert weekend to saturday
UPDATE available_times SET day_type = 'saturday' WHERE day_type = 'weekend';

-- Remove old weekday rows
DELETE FROM available_times WHERE day_type = 'weekday';

-- Add new unique constraint (time_slot + day_type)
ALTER TABLE available_times ADD CONSTRAINT available_times_time_day_unique UNIQUE (time_slot, day_type);

-- Add new check constraint
ALTER TABLE available_times ADD CONSTRAINT available_times_day_type_check 
CHECK (day_type IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'));


-- File: 20260420231415_53a0b7c4-2fcb-4993-912e-a9f12127afed.sql

DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;

DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments
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


-- File: 20260420231755_64067fa2-9b7d-40af-9b29-c34ec2d756b4.sql
UPDATE public.site_settings SET value = '42', updated_at = now() WHERE key = 'theme_primary_h';
UPDATE public.site_settings SET value = '65', updated_at = now() WHERE key = 'theme_primary_s';
UPDATE public.site_settings SET value = '52', updated_at = now() WHERE key = 'theme_primary_l';
UPDATE public.site_settings SET value = '38', updated_at = now() WHERE key = 'theme_accent_h';
UPDATE public.site_settings SET value = '70', updated_at = now() WHERE key = 'theme_accent_s';
UPDATE public.site_settings SET value = '65', updated_at = now() WHERE key = 'theme_accent_l';
UPDATE public.site_settings SET value = '40', updated_at = now() WHERE key = 'theme_background_h';
UPDATE public.site_settings SET value = '30', updated_at = now() WHERE key = 'theme_background_s';
UPDATE public.site_settings SET value = '98', updated_at = now() WHERE key = 'theme_background_l';

-- File: 20260421002316_324f7431-1ead-436d-a3cd-a4360b97c536.sql

-- 1) Fix anonymous insert binding on appointments
DROP POLICY IF EXISTS "Anyone can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

DROP POLICY IF EXISTS "Guests or owners can insert appointments" ON public.appointments;
CREATE POLICY "Guests or owners can insert appointments" ON public.appointments
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
DROP POLICY IF EXISTS "Admins can view blocked slots" ON public.blocked_slots;
CREATE POLICY "Admins can view blocked slots" ON public.blocked_slots
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


-- File: 20260514024703_9f0177ae-2f9e-4b85-b805-74bfd0a349d5.sql
UPDATE public.site_settings SET value='https://www.instagram.com/jessica_magalhaes_nail', updated_at=now() WHERE key='instagram_url';

-- File: 20260614185641_6bb41bdc-623c-470d-a3e3-6cb9b93d4874.sql

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL DEFAULT '',
  instance_token text NOT NULL DEFAULT '',
  admin_number text NOT NULL DEFAULT '559191837179',
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Admins can view whatsapp config" ON public.whatsapp_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Admins can insert whatsapp config" ON public.whatsapp_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Admins can update whatsapp config" ON public.whatsapp_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Admins can delete whatsapp config" ON public.whatsapp_config FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_whatsapp_config_updated_at ON public.whatsapp_config;
DROP TRIGGER IF EXISTS update_whatsapp_config_updated_at ON public.whatsapp_config;
CREATE TRIGGER update_whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_config (instance_id, instance_token, admin_number, enabled)
VALUES ('', '', '559191837179', false);


-- File: 20260626205516_cd47d44a-163f-49b7-b6c9-368018cd5286.sql

-- Lock down user_roles inserts to admins only (explicit restrictive policy)
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles" ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles" ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Restrictive policy guarantees no permissive policy can ever let a non-admin write
DROP POLICY IF EXISTS "Restrict role writes to admins" ON public.user_roles;
CREATE POLICY "Restrict role writes to admins" ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous booking flow to read blocked slots (date/time only) via the existing SECURITY DEFINER RPC.
-- Grant execute to anon so unauthenticated bookings can check availability without exposing the 'reason' column.
GRANT EXECUTE ON FUNCTION public.get_blocked_slots(date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon;


-- File: 20260626210130_c8cac7f8-2e4a-4e02-a15a-43bad6e0be2a.sql

CREATE TABLE IF NOT EXISTS public.maintenance_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

GRANT SELECT, INSERT, DELETE ON public.maintenance_reminders_sent TO authenticated;
GRANT ALL ON public.maintenance_reminders_sent TO service_role;

ALTER TABLE public.maintenance_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage maintenance reminders" ON public.maintenance_reminders_sent;
CREATE POLICY "Admins manage maintenance reminders" ON public.maintenance_reminders_sent
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_sent_appt ON public.maintenance_reminders_sent(appointment_id);


-- ==========================================
-- Assign Admin Role to jessica@gmail.com
-- ==========================================
INSERT INTO public.user_roles (user_id, role)
VALUES ('d4949733-3693-42a4-b3d1-9226aa467e21', 'admin')
ON CONFLICT DO NOTHING;

-- File: 20260626211500_hour_reminders_cron.sql
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

-- File: 20260626213000_slot_holds.sql
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



