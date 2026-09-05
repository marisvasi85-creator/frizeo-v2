-- Barber slugs are unique per salon, matching /booking/salon/{tenant}/{barber}.
-- The previous global unique constraint blocked the same first name in two salons.

CREATE UNIQUE INDEX IF NOT EXISTS barbers_tenant_slug_uidx
  ON public.barbers (tenant_id, slug)
  WHERE slug IS NOT NULL;

ALTER TABLE public.barbers DROP CONSTRAINT IF EXISTS barbers_slug_key;
