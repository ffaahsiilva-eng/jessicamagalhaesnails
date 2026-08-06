-- Remove duplicatas existentes (mantém o mais antigo) antes de criar a regra
WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY appointment_date, appointment_time
    ORDER BY created_at ASC
  ) AS rn
  FROM public.appointments
  WHERE status <> 'cancelled'
)
UPDATE public.appointments a
SET status = 'cancelled', updated_at = now()
FROM dups
WHERE a.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_active_slot
  ON public.appointments (appointment_date, appointment_time)
  WHERE status <> 'cancelled';