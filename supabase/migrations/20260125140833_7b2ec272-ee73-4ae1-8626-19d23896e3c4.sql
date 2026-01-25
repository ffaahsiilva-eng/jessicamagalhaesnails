-- Add business hours settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
('business_hours_weekday', 'Seg-Sáb: 9h às 19h', 'Horário Semana', 'text', 'contact'),
('business_hours_note', 'Atendimento com hora marcada', 'Observação', 'text', 'contact');