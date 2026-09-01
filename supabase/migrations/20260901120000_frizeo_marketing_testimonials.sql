-- Public Frizeo marketing testimonials (/review form + homepage section).

BEGIN;

CREATE TABLE IF NOT EXISTS public.frizeo_marketing_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  author_name text NOT NULL,
  salon_name text,
  city text,
  user_type text NOT NULL CHECK (user_type IN ('independent', 'barbershop')),
  body text NOT NULL,
  photo_url text,
  display_consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS frizeo_marketing_testimonials_status_created_idx
  ON public.frizeo_marketing_testimonials (status, created_at DESC);

CREATE INDEX IF NOT EXISTS frizeo_marketing_testimonials_approved_idx
  ON public.frizeo_marketing_testimonials (status, reviewed_at DESC)
  WHERE status = 'approved';

ALTER TABLE public.frizeo_marketing_testimonials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.frizeo_marketing_testimonials FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frizeo_marketing_testimonials TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'frizeo-testimonial-photos',
  'frizeo-testimonial-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

COMMIT;
