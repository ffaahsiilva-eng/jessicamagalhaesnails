-- Criar tabela para horários bloqueados
CREATE TABLE public.blocked_slots (
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
CREATE POLICY "Anyone can view blocked slots"
ON public.blocked_slots
FOR SELECT
USING (true);

-- Apenas admins podem gerenciar bloqueios
CREATE POLICY "Admins can insert blocked slots"
ON public.blocked_slots
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blocked slots"
ON public.blocked_slots
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));