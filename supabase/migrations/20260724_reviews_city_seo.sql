-- Reviews + AI city intros for directory SEO.
-- Run in Supabase SQL Editor after deploy.

BEGIN;

CREATE TABLE IF NOT EXISTS public.salon_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  author_name text NOT NULL,
  comment text,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS salon_reviews_booking_id_uidx
  ON public.salon_reviews (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS salon_reviews_tenant_approved_idx
  ON public.salon_reviews (tenant_id, approved, created_at DESC);

ALTER TABLE public.salon_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.city_seo_pages (
  city_slug text PRIMARY KEY,
  city_name text NOT NULL,
  intro text NOT NULL,
  source text NOT NULL DEFAULT 'template',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.city_seo_pages ENABLE ROW LEVEL SECURITY;

COMMIT;
