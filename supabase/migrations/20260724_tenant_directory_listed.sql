-- Directory / local SEO: salons can opt into Frizeo city directory.
-- Booking pages stay public either way.
-- Run in Supabase SQL Editor (shared staging/prod project).

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS directory_listed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tenants.directory_listed IS
  'When true, salon may appear in /frizerii and city directory pages.';

COMMIT;
