-- Frizeo Email (Phase 2): reusable templates, campaign drafts and audience snapshots.
-- Additive only. Bulk sending, provider webhooks and delivery analytics belong to Phase 3.

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_frizeo_email_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Responsive email content templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 200),
  preview_text text NOT NULL DEFAULT '' CHECK (char_length(preview_text) <= 300),
  heading text NOT NULL DEFAULT '' CHECK (char_length(heading) <= 200),
  body_text text NOT NULL DEFAULT '' CHECK (char_length(body_text) <= 50000),
  image_url text CHECK (image_url IS NULL OR char_length(image_url) <= 2000),
  cta_text text CHECK (cta_text IS NULL OR char_length(cta_text) <= 120),
  cta_url text CHECK (cta_url IS NULL OR char_length(cta_url) <= 2000),
  footer_text text NOT NULL DEFAULT '' CHECK (char_length(footer_text) <= 2000),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_email_templates_name_uidx
  ON public.marketing_email_templates (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS marketing_email_templates_one_default_uidx
  ON public.marketing_email_templates (is_default)
  WHERE is_default = true;
CREATE INDEX IF NOT EXISTS marketing_email_templates_created_at_idx
  ON public.marketing_email_templates (created_at DESC);

DROP TRIGGER IF EXISTS marketing_email_templates_set_updated_at
  ON public.marketing_email_templates;
CREATE TRIGGER marketing_email_templates_set_updated_at
BEFORE UPDATE ON public.marketing_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_frizeo_email_updated_at();

ALTER TABLE public.marketing_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_email_templates_platform_admin_all"
  ON public.marketing_email_templates;
CREATE POLICY "marketing_email_templates_platform_admin_all"
ON public.marketing_email_templates
FOR ALL
TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_email_templates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.marketing_email_templates TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Campaign drafts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 200),
  preview_text text NOT NULL DEFAULT '' CHECK (char_length(preview_text) <= 300),
  sender_name text NOT NULL DEFAULT 'Frizeo' CHECK (char_length(sender_name) <= 120),
  sender_email text NOT NULL DEFAULT '' CHECK (char_length(sender_email) <= 320),
  reply_to text CHECK (reply_to IS NULL OR char_length(reply_to) <= 320),
  template_id uuid REFERENCES public.marketing_email_templates (id) ON DELETE SET NULL,
  heading text NOT NULL DEFAULT '' CHECK (char_length(heading) <= 200),
  body_text text NOT NULL DEFAULT '' CHECK (char_length(body_text) <= 50000),
  image_url text CHECK (image_url IS NULL OR char_length(image_url) <= 2000),
  cta_text text CHECK (cta_text IS NULL OR char_length(cta_text) <= 120),
  cta_url text CHECK (cta_url IS NULL OR char_length(cta_url) <= 2000),
  footer_text text NOT NULL DEFAULT '' CHECK (char_length(footer_text) <= 2000),
  audience_kind text NOT NULL DEFAULT 'all_subscribed'
    CHECK (audience_kind IN ('all_subscribed', 'leads', 'registered_users')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  delivered_count integer NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  opened_count integer NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  clicked_count integer NOT NULL DEFAULT 0 CHECK (clicked_count >= 0),
  bounced_count integer NOT NULL DEFAULT 0 CHECK (bounced_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  audience_snapshot_at timestamptz,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_status_created_at_idx
  ON public.marketing_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_campaigns_template_id_idx
  ON public.marketing_campaigns (template_id)
  WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_campaigns_scheduled_at_idx
  ON public.marketing_campaigns (scheduled_at)
  WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS marketing_campaigns_set_updated_at
  ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_set_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.set_frizeo_email_updated_at();

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_campaigns_platform_admin_all"
  ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_platform_admin_all"
ON public.marketing_campaigns
FOR ALL
TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_campaigns FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.marketing_campaigns TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Immutable-per-launch audience snapshot (rows are prepared in Phase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.marketing_campaigns (id) ON DELETE CASCADE,
  contact_id uuid
    REFERENCES public.marketing_contacts (id) ON DELETE SET NULL,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  first_name text,
  last_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'queued', 'sending', 'sent', 'delivered', 'opened', 'clicked',
      'bounced', 'complained', 'unsubscribed', 'failed', 'skipped'
    )),
  provider text,
  provider_message_id text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaign_recipients_campaign_email_key
    UNIQUE (campaign_id, email_normalized)
);

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_campaign_status_idx
  ON public.marketing_campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_contact_id_idx
  ON public.marketing_campaign_recipients (contact_id)
  WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaign_recipients_provider_message_uidx
  ON public.marketing_campaign_recipients (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

DROP TRIGGER IF EXISTS marketing_campaign_recipients_set_updated_at
  ON public.marketing_campaign_recipients;
CREATE TRIGGER marketing_campaign_recipients_set_updated_at
BEFORE UPDATE ON public.marketing_campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION public.set_frizeo_email_updated_at();

ALTER TABLE public.marketing_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_campaign_recipients_platform_admin_all"
  ON public.marketing_campaign_recipients;
CREATE POLICY "marketing_campaign_recipients_platform_admin_all"
ON public.marketing_campaign_recipients
FOR ALL
TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_campaign_recipients FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.marketing_campaign_recipients TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transactional audience snapshot. Only the server service role can execute.
-- Existing snapshots are replaceable only while the campaign is still a draft.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_marketing_campaign_audience(
  p_campaign_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_audience_kind text;
  v_status text;
  v_recipient_count integer;
BEGIN
  SELECT c.audience_kind, c.status
    INTO v_audience_kind, v_status
  FROM public.marketing_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'campaign_not_draft';
  END IF;

  DELETE FROM public.marketing_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id;

  INSERT INTO public.marketing_campaign_recipients (
    campaign_id,
    contact_id,
    email,
    first_name,
    last_name,
    status
  )
  SELECT
    p_campaign_id,
    contact.id,
    contact.email,
    contact.first_name,
    contact.last_name,
    'pending'
  FROM public.marketing_contacts contact
  WHERE contact.status = 'subscribed'
    AND contact.marketing_consent = true
    AND contact.unsubscribed_at IS NULL
    AND (
      v_audience_kind = 'all_subscribed'
      OR (v_audience_kind = 'leads' AND contact.user_id IS NULL)
      OR (v_audience_kind = 'registered_users' AND contact.user_id IS NOT NULL)
    )
  ORDER BY contact.created_at ASC;

  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  UPDATE public.marketing_campaigns
  SET recipient_count = v_recipient_count,
      audience_snapshot_at = now()
  WHERE id = p_campaign_id;

  RETURN v_recipient_count;
END;
$$;

REVOKE ALL
  ON FUNCTION public.snapshot_marketing_campaign_audience(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.snapshot_marketing_campaign_audience(uuid)
  TO service_role;

-- A safe starter template for the internal editor.
INSERT INTO public.marketing_email_templates (
  name,
  subject,
  preview_text,
  heading,
  body_text,
  cta_text,
  cta_url,
  footer_text,
  is_default
)
VALUES (
  'Frizeo standard',
  'Noutăți de la Frizeo',
  'Un mesaj scurt de la echipa Frizeo.',
  'Salut!',
  E'Avem o noutate pentru tine.\n\nEditează acest mesaj înainte să trimiți campania.',
  'Descoperă Frizeo',
  'https://www.frizeo.ro',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true
)
ON CONFLICT DO NOTHING;

COMMIT;
