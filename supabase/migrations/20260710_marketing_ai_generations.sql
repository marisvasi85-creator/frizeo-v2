-- Marketing AI usage tracking (daily limits per salon)
CREATE TABLE IF NOT EXISTS public.marketing_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  content_type text NOT NULL,
  provider text NOT NULL,
  usage_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_date_idx
  ON public.marketing_ai_generations (tenant_id, usage_date);

ALTER TABLE public.marketing_ai_generations ENABLE ROW LEVEL SECURITY;
