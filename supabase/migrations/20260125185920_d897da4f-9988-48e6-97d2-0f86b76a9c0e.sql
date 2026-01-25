-- Insert font settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
  ('font_display', 'Cormorant Garamond', 'Fonte dos Títulos', 'select', 'fonts'),
  ('font_body', 'Montserrat', 'Fonte do Corpo', 'select', 'fonts')
ON CONFLICT (key) DO NOTHING;