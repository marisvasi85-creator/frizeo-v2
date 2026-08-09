-- Frizeo Email (Phase 1): platform admins, marketing contacts, unsubscribe.
-- Safe / idempotent: additive schema only; does not alter existing Frizeo tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- Platform admins (global — NOT tenant owner)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_email_normalized_uidx
  ON public.platform_admins (lower(trim(email)));

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_select_self" ON public.platform_admins;
CREATE POLICY "platform_admins_select_self"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Writes only via service_role (Next.js sync from allowlist).
REVOKE INSERT, UPDATE, DELETE ON public.platform_admins FROM anon, authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Marketing contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  first_name text,
  last_name text,
  phone text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('frizeo_user', 'external_lead', 'csv', 'manual')),
  status text NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_source text,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_contacts_email_normalized_key UNIQUE (email_normalized)
);

CREATE INDEX IF NOT EXISTS marketing_contacts_email_normalized_idx
  ON public.marketing_contacts (email_normalized);
CREATE INDEX IF NOT EXISTS marketing_contacts_status_idx
  ON public.marketing_contacts (status);
CREATE INDEX IF NOT EXISTS marketing_contacts_source_idx
  ON public.marketing_contacts (source);
CREATE INDEX IF NOT EXISTS marketing_contacts_user_id_idx
  ON public.marketing_contacts (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_contacts_tenant_id_idx
  ON public.marketing_contacts (tenant_id)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_contacts_consent_idx
  ON public.marketing_contacts (marketing_consent)
  WHERE marketing_consent = true;
CREATE INDEX IF NOT EXISTS marketing_contacts_created_at_idx
  ON public.marketing_contacts (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_marketing_contacts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_contacts_set_updated_at ON public.marketing_contacts;
CREATE TRIGGER marketing_contacts_set_updated_at
BEFORE UPDATE ON public.marketing_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_contacts_updated_at();

ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_contacts_platform_admin_all" ON public.marketing_contacts;
CREATE POLICY "marketing_contacts_platform_admin_all"
ON public.marketing_contacts
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

REVOKE ALL ON public.marketing_contacts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_contacts TO authenticated;

-- ---------------------------------------------------------------------------
-- Unsubscribe tokens + audit events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT marketing_unsubscribe_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS marketing_unsubscribe_tokens_contact_id_idx
  ON public.marketing_unsubscribe_tokens (contact_id);

CREATE TABLE IF NOT EXISTS public.marketing_unsubscribe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.marketing_contacts (id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.marketing_unsubscribe_tokens (id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_unsubscribe_events_contact_id_idx
  ON public.marketing_unsubscribe_events (contact_id);
CREATE INDEX IF NOT EXISTS marketing_unsubscribe_events_created_at_idx
  ON public.marketing_unsubscribe_events (created_at DESC);

ALTER TABLE public.marketing_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_unsubscribe_events ENABLE ROW LEVEL SECURITY;

-- Platform admins can read tokens/events; public unsubscribe goes through service_role API.
DROP POLICY IF EXISTS "marketing_unsub_tokens_platform_admin_select"
  ON public.marketing_unsubscribe_tokens;
CREATE POLICY "marketing_unsub_tokens_platform_admin_select"
ON public.marketing_unsubscribe_tokens
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "marketing_unsub_events_platform_admin_select"
  ON public.marketing_unsubscribe_events;
CREATE POLICY "marketing_unsub_events_platform_admin_select"
ON public.marketing_unsubscribe_events
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

REVOKE ALL ON public.marketing_unsubscribe_tokens FROM anon, authenticated;
REVOKE ALL ON public.marketing_unsubscribe_events FROM anon, authenticated;
GRANT SELECT ON public.marketing_unsubscribe_tokens TO authenticated;
GRANT SELECT ON public.marketing_unsubscribe_events TO authenticated;

COMMIT;
