-- Internal creator notes on tenants (Platform Assistant).
-- Access: service_role only (RLS on, no anon/authenticated policies).

CREATE TABLE IF NOT EXISTS public.platform_tenant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_email text,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_tenant_notes_tenant_created_idx
  ON public.platform_tenant_notes (tenant_id, created_at DESC);

COMMENT ON TABLE public.platform_tenant_notes IS
  'Creator-only internal notes about a salon (Platform Assistant).';

ALTER TABLE public.platform_tenant_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_tenant_notes FROM anon, authenticated;
GRANT ALL ON public.platform_tenant_notes TO service_role;
