-- Salon + barber location fields (Maps / Waze / embed)

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS location_address_line text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_county text,
  ADD COLUMN IF NOT EXISTS location_postal_code text,
  ADD COLUMN IF NOT EXISTS location_maps_url text,
  ADD COLUMN IF NOT EXISTS location_latitude double precision,
  ADD COLUMN IF NOT EXISTS location_longitude double precision;

UPDATE public.tenants
SET location_address_line = address
WHERE address IS NOT NULL
  AND (location_address_line IS NULL OR location_address_line = '');

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS use_salon_location boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_address_line text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_county text,
  ADD COLUMN IF NOT EXISTS location_postal_code text,
  ADD COLUMN IF NOT EXISTS location_maps_url text,
  ADD COLUMN IF NOT EXISTS location_latitude double precision,
  ADD COLUMN IF NOT EXISTS location_longitude double precision;

COMMIT;
