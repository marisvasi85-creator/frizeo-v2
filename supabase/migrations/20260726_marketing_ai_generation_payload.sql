-- Marketing AI usage + history (self-contained)
-- Safe to run even if 20260710_marketing_ai_generations.sql was never applied.

CREATE TABLE IF NOT EXISTS public.marketing_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  content_type text NOT NULL,
  provider text NOT NULL,
  usage_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text,
  content text,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  call_to_action text,
  service_id uuid REFERENCES public.barber_services(id) ON DELETE SET NULL,
  counts_toward_limit boolean NOT NULL DEFAULT true
);

-- Upgrade path if the older usage-only table already exists
ALTER TABLE public.marketing_ai_generations
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS call_to_action text,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.barber_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counts_toward_limit boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_date_idx
  ON public.marketing_ai_generations (tenant_id, usage_date);

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_created_idx
  ON public.marketing_ai_generations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_date_counted_idx
  ON public.marketing_ai_generations (tenant_id, usage_date)
  WHERE counts_toward_limit = true;

ALTER TABLE public.marketing_ai_generations ENABLE ROW LEVEL SECURITY;
