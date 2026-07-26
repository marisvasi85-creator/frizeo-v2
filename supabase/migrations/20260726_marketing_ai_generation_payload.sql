-- Persist Marketing AI generation content for history / reopen
ALTER TABLE public.marketing_ai_generations
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS call_to_action text,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.barber_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counts_toward_limit boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_created_idx
  ON public.marketing_ai_generations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketing_ai_generations_tenant_date_counted_idx
  ON public.marketing_ai_generations (tenant_id, usage_date)
  WHERE counts_toward_limit = true;
