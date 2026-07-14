-- Păstrează linkurile vechi funcționale după schimbarea slug-ului salonului sau frizerului.
CREATE TABLE IF NOT EXISTS public.slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('tenant', 'barber')),
  entity_id uuid NOT NULL,
  old_slug text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_redirects_barber_requires_tenant
    CHECK (
      entity_type = 'tenant' AND tenant_id IS NULL
      OR entity_type = 'barber' AND tenant_id IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS slug_redirects_tenant_old_slug_idx
  ON public.slug_redirects (old_slug)
  WHERE entity_type = 'tenant';

CREATE UNIQUE INDEX IF NOT EXISTS slug_redirects_barber_old_slug_idx
  ON public.slug_redirects (tenant_id, old_slug)
  WHERE entity_type = 'barber';

CREATE INDEX IF NOT EXISTS slug_redirects_entity_idx
  ON public.slug_redirects (entity_type, entity_id);

ALTER TABLE public.slug_redirects ENABLE ROW LEVEL SECURITY;
