-- Insert font size settings
INSERT INTO public.site_settings (key, value, label, type, category) VALUES
  ('font_scale', '1', 'Escala de Fonte', 'range', 'fonts'),
  ('font_heading_size', 'normal', 'Tamanho dos Títulos', 'select', 'fonts'),
  ('font_body_size', 'normal', 'Tamanho do Corpo', 'select', 'fonts')
ON CONFLICT (key) DO NOTHING;