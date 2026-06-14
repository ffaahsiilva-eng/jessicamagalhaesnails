
CREATE TABLE public.whatsapp_config (
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

CREATE POLICY "Admins can view whatsapp config"
ON public.whatsapp_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert whatsapp config"
ON public.whatsapp_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update whatsapp config"
ON public.whatsapp_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete whatsapp config"
ON public.whatsapp_config FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_config (instance_id, instance_token, admin_number, enabled)
VALUES ('', '', '559191837179', false);
