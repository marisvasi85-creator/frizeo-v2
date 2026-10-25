-- Salon replies and abuse reports. Additive only.
-- Owners cannot delete or hide a review. Platform creator resolves reports.
-- Public rating still uses approved + booking eligibility and ignores the reply.

ALTER TABLE public.salon_reviews
  ADD COLUMN IF NOT EXISTS owner_reply text,
  ADD COLUMN IF NOT EXISTS owner_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_reply_by uuid;

ALTER TABLE public.salon_reviews
  DROP CONSTRAINT IF EXISTS salon_reviews_owner_reply_len;

ALTER TABLE public.salon_reviews
  ADD CONSTRAINT salon_reviews_owner_reply_len
  CHECK (owner_reply IS NULL OR char_length(owner_reply) <= 1000);

COMMENT ON COLUMN public.salon_reviews.owner_reply IS
  'Salon reply shown under the public review. It does not change the rating.';

CREATE TABLE IF NOT EXISTS public.salon_review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.salon_reviews (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  reported_by uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  CONSTRAINT salon_review_reports_reason_len CHECK (
    char_length(btrim(reason)) >= 10 AND char_length(reason) <= 500
  ),
  CONSTRAINT salon_review_reports_status_check CHECK (
    status IN ('open', 'hidden', 'reactivated')
  )
);

COMMENT ON TABLE public.salon_review_reports IS
  'Abuse reports for salon reviews. Reviews are never deleted from this flow.';

CREATE INDEX IF NOT EXISTS salon_review_reports_tenant_review_idx
  ON public.salon_review_reports (tenant_id, review_id);

CREATE INDEX IF NOT EXISTS salon_review_reports_status_created_idx
  ON public.salon_review_reports (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS salon_review_reports_one_open_idx
  ON public.salon_review_reports (review_id)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.salon_review_reports_same_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.salon_reviews AS review
    WHERE review.id = NEW.review_id
      AND review.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'report tenant does not match the review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS salon_review_reports_same_tenant ON public.salon_review_reports;

CREATE TRIGGER salon_review_reports_same_tenant
  BEFORE INSERT OR UPDATE ON public.salon_review_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.salon_review_reports_same_tenant();

REVOKE ALL ON FUNCTION public.salon_review_reports_same_tenant() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.salon_review_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.salon_review_reports FROM anon, authenticated;
GRANT ALL ON public.salon_review_reports TO service_role;
