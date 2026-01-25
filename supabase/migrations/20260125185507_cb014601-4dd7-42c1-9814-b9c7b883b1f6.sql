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