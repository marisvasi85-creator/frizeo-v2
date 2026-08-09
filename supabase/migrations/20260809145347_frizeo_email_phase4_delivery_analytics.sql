-- Frizeo Email (Phase 4): verified Resend events and delivery analytics.
-- Additive and scoped exclusively to marketing_* objects.

BEGIN;

ALTER TABLE public.marketing_contacts
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS suppression_reason text;

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS complained_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribed_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_complained_count_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_complained_count_check
  CHECK (complained_count >= 0);

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_unsubscribed_count_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_unsubscribed_count_check
  CHECK (unsubscribed_count >= 0);

ALTER TABLE public.marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_delayed_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS bounce_subtype text,
  ADD COLUMN IF NOT EXISTS bounce_reason text,
  ADD COLUMN IF NOT EXISTS last_event_type text,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

UPDATE public.marketing_campaign_recipients
SET first_opened_at = coalesce(first_opened_at, opened_at),
    last_opened_at = coalesce(last_opened_at, opened_at),
    first_clicked_at = coalesce(first_clicked_at, clicked_at),
    last_clicked_at = coalesce(last_clicked_at, clicked_at)
WHERE opened_at IS NOT NULL OR clicked_at IS NOT NULL;

ALTER TABLE public.marketing_unsubscribe_events
  ADD COLUMN IF NOT EXISTS campaign_recipient_id uuid
  REFERENCES public.marketing_campaign_recipients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_unsubscribe_events_recipient_idx
  ON public.marketing_unsubscribe_events (campaign_recipient_id)
  WHERE campaign_recipient_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
  provider_event_id text NOT NULL CHECK (
    char_length(provider_event_id) BETWEEN 1 AND 255
  ),
  provider_message_id text CHECK (
    provider_message_id IS NULL OR char_length(provider_message_id) <= 255
  ),
  campaign_id uuid
    REFERENCES public.marketing_campaigns (id) ON DELETE CASCADE,
  recipient_id uuid
    REFERENCES public.marketing_campaign_recipients (id) ON DELETE CASCADE,
  contact_id uuid
    REFERENCES public.marketing_contacts (id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
    'bounced', 'complained', 'failed', 'suppressed', 'unsubscribed'
  )),
  event_timestamp timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_email_events_provider_event_key
    UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS marketing_email_events_message_idx
  ON public.marketing_email_events (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_email_events_campaign_time_idx
  ON public.marketing_email_events (campaign_id, event_timestamp DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_email_events_recipient_time_idx
  ON public.marketing_email_events (recipient_id, event_timestamp DESC)
  WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_email_events_contact_time_idx
  ON public.marketing_email_events (contact_id, event_timestamp DESC)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_email_events_type_time_idx
  ON public.marketing_email_events (type, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS marketing_email_events_time_idx
  ON public.marketing_email_events (event_timestamp DESC);

ALTER TABLE public.marketing_email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_email_events_platform_admin_select"
  ON public.marketing_email_events;
CREATE POLICY "marketing_email_events_platform_admin_select"
ON public.marketing_email_events
FOR SELECT
TO authenticated
USING ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketing_email_events TO authenticated, service_role;
GRANT INSERT ON public.marketing_email_events TO service_role;

-- Materialized counters are unique-recipient counts derived from lifecycle
-- timestamps. Opens/clicks deliberately do not replace the delivery status.
CREATE OR REPLACE FUNCTION public.refresh_marketing_campaign_progress(
  p_campaign_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_total integer;
  v_active integer;
  v_sent integer;
  v_delivered integer;
  v_opened integer;
  v_clicked integer;
  v_bounced integer;
  v_complained integer;
  v_unsubscribed integer;
  v_failed integer;
  v_skipped integer;
BEGIN
  SELECT c.status
    INTO v_status
  FROM public.marketing_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE r.status IN ('pending', 'queued', 'sending'))::integer,
    count(*) FILTER (WHERE r.sent_at IS NOT NULL)::integer,
    count(*) FILTER (WHERE r.delivered_at IS NOT NULL)::integer,
    count(*) FILTER (
      WHERE coalesce(r.first_opened_at, r.opened_at) IS NOT NULL
    )::integer,
    count(*) FILTER (
      WHERE coalesce(r.first_clicked_at, r.clicked_at) IS NOT NULL
    )::integer,
    count(*) FILTER (WHERE r.bounced_at IS NOT NULL)::integer,
    count(*) FILTER (WHERE r.complained_at IS NOT NULL)::integer,
    count(*) FILTER (WHERE r.unsubscribed_at IS NOT NULL)::integer,
    count(*) FILTER (WHERE r.status = 'failed')::integer,
    count(*) FILTER (WHERE r.status = 'skipped')::integer
    INTO
      v_total, v_active, v_sent, v_delivered, v_opened, v_clicked,
      v_bounced, v_complained, v_unsubscribed, v_failed, v_skipped
  FROM public.marketing_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id;

  UPDATE public.marketing_campaigns c
  SET recipient_count = v_total,
      sent_count = v_sent,
      delivered_count = v_delivered,
      opened_count = v_opened,
      clicked_count = v_clicked,
      bounced_count = v_bounced,
      complained_count = v_complained,
      unsubscribed_count = v_unsubscribed,
      failed_count = v_failed,
      status = CASE
        WHEN v_status = 'cancelled' THEN 'cancelled'
        WHEN v_active > 0 THEN v_status
        WHEN v_sent = v_total AND v_total > 0 THEN 'sent'
        WHEN v_sent > 0 AND (v_failed + v_skipped) > 0 THEN 'partially_failed'
        ELSE 'failed'
      END,
      completed_at = CASE
        WHEN v_status = 'cancelled' THEN c.completed_at
        WHEN v_active = 0 THEN coalesce(c.completed_at, now())
        ELSE NULL
      END,
      sent_at = CASE
        WHEN v_status <> 'cancelled' AND v_active = 0 AND v_sent = v_total
          THEN coalesce(c.sent_at, now())
        ELSE c.sent_at
      END,
      failed_at = CASE
        WHEN v_status <> 'cancelled' AND v_active = 0 AND v_sent = 0
          THEN coalesce(c.failed_at, now())
        ELSE c.failed_at
      END
  WHERE c.id = p_campaign_id;
END;
$$;

REVOKE ALL
  ON FUNCTION public.refresh_marketing_campaign_progress(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.refresh_marketing_campaign_progress(uuid)
  TO service_role;

-- One transaction performs: exact provider-message match, idempotent event
-- insert, recipient lifecycle update, contact suppression, counter refresh.
CREATE OR REPLACE FUNCTION public.process_marketing_email_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_type text,
  p_event_timestamp timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_bounce_type text DEFAULT NULL,
  p_bounce_subtype text DEFAULT NULL,
  p_bounce_reason text DEFAULT NULL,
  p_permanent_bounce boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_recipient public.marketing_campaign_recipients%ROWTYPE;
  v_event_id uuid;
  v_safe_metadata jsonb;
BEGIN
  IF p_provider <> 'resend'
     OR p_provider_event_id IS NULL
     OR char_length(trim(p_provider_event_id)) NOT BETWEEN 1 AND 255
     OR p_provider_message_id IS NULL
     OR char_length(trim(p_provider_message_id)) NOT BETWEEN 1 AND 255
     OR p_type NOT IN (
       'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
       'bounced', 'complained', 'failed', 'suppressed'
     )
     OR p_event_timestamp IS NULL THEN
    RAISE EXCEPTION 'invalid_marketing_email_event';
  END IF;

  v_safe_metadata := CASE
    WHEN jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
      THEN coalesce(p_metadata, '{}'::jsonb)
    ELSE '{}'::jsonb
  END;

  SELECT recipient.*
    INTO v_recipient
  FROM public.marketing_campaign_recipients recipient
  WHERE recipient.provider = p_provider
    AND recipient.provider_message_id = p_provider_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'result', 'unmatched',
      'matched', false,
      'duplicate', false
    );
  END IF;

  INSERT INTO public.marketing_email_events (
    provider,
    provider_event_id,
    provider_message_id,
    campaign_id,
    recipient_id,
    contact_id,
    type,
    event_timestamp,
    metadata
  )
  VALUES (
    p_provider,
    trim(p_provider_event_id),
    trim(p_provider_message_id),
    v_recipient.campaign_id,
    v_recipient.id,
    v_recipient.contact_id,
    p_type,
    p_event_timestamp,
    v_safe_metadata
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'result', 'duplicate',
      'matched', true,
      'duplicate', true,
      'recipient_id', v_recipient.id,
      'campaign_id', v_recipient.campaign_id
    );
  END IF;

  IF p_type = 'sent' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET sent_at = CASE
          WHEN recipient.sent_at IS NULL OR p_event_timestamp < recipient.sent_at
            THEN p_event_timestamp
          ELSE recipient.sent_at
        END,
        status = CASE
          WHEN recipient.status IN ('pending', 'queued', 'sending') THEN 'sent'
          ELSE recipient.status
        END
    WHERE recipient.id = v_recipient.id;
  ELSIF p_type = 'delivered' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET delivered_at = CASE
          WHEN recipient.delivered_at IS NULL
               OR p_event_timestamp < recipient.delivered_at
            THEN p_event_timestamp
          ELSE recipient.delivered_at
        END,
        status = CASE
          WHEN recipient.status IN ('pending', 'queued', 'sending', 'sent')
            THEN 'delivered'
          ELSE recipient.status
        END
    WHERE recipient.id = v_recipient.id;
  ELSIF p_type = 'delivery_delayed' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET delivery_delayed_at = CASE
          WHEN recipient.delivery_delayed_at IS NULL
               OR p_event_timestamp > recipient.delivery_delayed_at
            THEN p_event_timestamp
          ELSE recipient.delivery_delayed_at
        END
    WHERE recipient.id = v_recipient.id;
  ELSIF p_type = 'opened' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET first_opened_at = CASE
          WHEN recipient.first_opened_at IS NULL
               OR p_event_timestamp < recipient.first_opened_at
            THEN p_event_timestamp
          ELSE recipient.first_opened_at
        END,
        last_opened_at = CASE
          WHEN recipient.last_opened_at IS NULL
               OR p_event_timestamp > recipient.last_opened_at
            THEN p_event_timestamp
          ELSE recipient.last_opened_at
        END,
        opened_at = CASE
          WHEN recipient.opened_at IS NULL OR p_event_timestamp < recipient.opened_at
            THEN p_event_timestamp
          ELSE recipient.opened_at
        END
    WHERE recipient.id = v_recipient.id;
  ELSIF p_type = 'clicked' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET first_clicked_at = CASE
          WHEN recipient.first_clicked_at IS NULL
               OR p_event_timestamp < recipient.first_clicked_at
            THEN p_event_timestamp
          ELSE recipient.first_clicked_at
        END,
        last_clicked_at = CASE
          WHEN recipient.last_clicked_at IS NULL
               OR p_event_timestamp > recipient.last_clicked_at
            THEN p_event_timestamp
          ELSE recipient.last_clicked_at
        END,
        clicked_at = CASE
          WHEN recipient.clicked_at IS NULL
               OR p_event_timestamp < recipient.clicked_at
            THEN p_event_timestamp
          ELSE recipient.clicked_at
        END
    WHERE recipient.id = v_recipient.id;
  ELSIF p_type = 'bounced' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET bounced_at = CASE
          WHEN recipient.bounced_at IS NULL OR p_event_timestamp < recipient.bounced_at
            THEN p_event_timestamp
          ELSE recipient.bounced_at
        END,
        bounce_type = left(nullif(trim(p_bounce_type), ''), 120),
        bounce_subtype = left(nullif(trim(p_bounce_subtype), ''), 120),
        bounce_reason = left(nullif(trim(p_bounce_reason), ''), 1000),
        error_message = left(coalesce(nullif(trim(p_bounce_reason), ''), 'email_bounced'), 1000),
        status = CASE
          WHEN recipient.status IN ('complained', 'unsubscribed')
            THEN recipient.status
          ELSE 'bounced'
        END
    WHERE recipient.id = v_recipient.id;

    IF p_permanent_bounce AND v_recipient.contact_id IS NOT NULL THEN
      UPDATE public.marketing_contacts contact
      SET status = CASE
            WHEN contact.status IN ('complained', 'unsubscribed')
              THEN contact.status
            ELSE 'bounced'
          END,
          marketing_consent = false,
          bounced_at = CASE
            WHEN contact.bounced_at IS NULL OR p_event_timestamp < contact.bounced_at
              THEN p_event_timestamp
            ELSE contact.bounced_at
          END,
          suppression_reason = left(
            coalesce(nullif(trim(p_bounce_reason), ''), 'permanent_bounce'),
            1000
          )
      WHERE contact.id = v_recipient.contact_id;
    END IF;
  ELSIF p_type = 'complained' THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET complained_at = CASE
          WHEN recipient.complained_at IS NULL
               OR p_event_timestamp < recipient.complained_at
            THEN p_event_timestamp
          ELSE recipient.complained_at
        END,
        status = 'complained',
        error_message = 'spam_complaint'
    WHERE recipient.id = v_recipient.id;

    IF v_recipient.contact_id IS NOT NULL THEN
      UPDATE public.marketing_contacts contact
      SET status = 'complained',
          marketing_consent = false,
          complained_at = CASE
            WHEN contact.complained_at IS NULL
                 OR p_event_timestamp < contact.complained_at
              THEN p_event_timestamp
            ELSE contact.complained_at
          END,
          suppression_reason = 'spam_complaint'
      WHERE contact.id = v_recipient.contact_id;
    END IF;
  ELSIF p_type IN ('failed', 'suppressed') THEN
    UPDATE public.marketing_campaign_recipients recipient
    SET failed_at = CASE
          WHEN recipient.failed_at IS NULL OR p_event_timestamp < recipient.failed_at
            THEN p_event_timestamp
          ELSE recipient.failed_at
        END,
        error_message = left(
          coalesce(v_safe_metadata ->> 'reason', p_type),
          1000
        ),
        status = CASE
          WHEN recipient.status IN ('bounced', 'complained', 'unsubscribed')
            THEN recipient.status
          ELSE 'failed'
        END
    WHERE recipient.id = v_recipient.id;
  END IF;

  UPDATE public.marketing_campaign_recipients recipient
  SET last_event_type = CASE
        WHEN recipient.last_event_at IS NULL
             OR p_event_timestamp >= recipient.last_event_at
          THEN p_type
        ELSE recipient.last_event_type
      END,
      last_event_at = CASE
        WHEN recipient.last_event_at IS NULL
             OR p_event_timestamp >= recipient.last_event_at
          THEN p_event_timestamp
        ELSE recipient.last_event_at
      END
  WHERE recipient.id = v_recipient.id;

  PERFORM public.refresh_marketing_campaign_progress(v_recipient.campaign_id);

  RETURN jsonb_build_object(
    'result', 'processed',
    'matched', true,
    'duplicate', false,
    'event_id', v_event_id,
    'recipient_id', v_recipient.id,
    'campaign_id', v_recipient.campaign_id
  );
END;
$$;

REVOKE ALL
  ON FUNCTION public.process_marketing_email_event(
    text, text, text, text, timestamptz, jsonb, text, text, text, boolean
  )
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.process_marketing_email_event(
    text, text, text, text, timestamptz, jsonb, text, text, text, boolean
  )
  TO service_role;

-- Link the existing public unsubscribe audit to the exact campaign recipient.
-- The contact unsubscribe itself remains owned by the Phase 1 flow.
CREATE OR REPLACE FUNCTION public.record_marketing_unsubscribe_analytics(
  p_unsubscribe_event_id uuid,
  p_unsubscribe_token text,
  p_event_timestamp timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_recipient public.marketing_campaign_recipients%ROWTYPE;
BEGIN
  IF p_unsubscribe_event_id IS NULL
     OR p_unsubscribe_token IS NULL
     OR char_length(p_unsubscribe_token) < 16
     OR p_event_timestamp IS NULL THEN
    RETURN false;
  END IF;

  SELECT recipient.*
    INTO v_recipient
  FROM public.marketing_campaign_recipients recipient
  WHERE recipient.unsubscribe_token = p_unsubscribe_token
  ORDER BY recipient.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.marketing_unsubscribe_events unsubscribe_event
  SET campaign_recipient_id = v_recipient.id
  WHERE unsubscribe_event.id = p_unsubscribe_event_id
    AND unsubscribe_event.contact_id = v_recipient.contact_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.marketing_email_events (
    provider,
    provider_event_id,
    provider_message_id,
    campaign_id,
    recipient_id,
    contact_id,
    type,
    event_timestamp,
    metadata
  )
  VALUES (
    'frizeo',
    'unsubscribe:' || p_unsubscribe_event_id::text,
    v_recipient.provider_message_id,
    v_recipient.campaign_id,
    v_recipient.id,
    v_recipient.contact_id,
    'unsubscribed',
    p_event_timestamp,
    jsonb_build_object('source', 'public_unsubscribe')
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING;

  UPDATE public.marketing_campaign_recipients recipient
  SET unsubscribed_at = CASE
        WHEN recipient.unsubscribed_at IS NULL
             OR p_event_timestamp < recipient.unsubscribed_at
          THEN p_event_timestamp
        ELSE recipient.unsubscribed_at
      END,
      status = CASE
        WHEN recipient.status = 'complained' THEN recipient.status
        ELSE 'unsubscribed'
      END,
      last_event_type = CASE
        WHEN recipient.last_event_at IS NULL
             OR p_event_timestamp >= recipient.last_event_at
          THEN 'unsubscribed'
        ELSE recipient.last_event_type
      END,
      last_event_at = CASE
        WHEN recipient.last_event_at IS NULL
             OR p_event_timestamp >= recipient.last_event_at
          THEN p_event_timestamp
        ELSE recipient.last_event_at
      END
  WHERE recipient.id = v_recipient.id;

  PERFORM public.refresh_marketing_campaign_progress(v_recipient.campaign_id);
  RETURN true;
END;
$$;

REVOKE ALL
  ON FUNCTION public.record_marketing_unsubscribe_analytics(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.record_marketing_unsubscribe_analytics(uuid, text, timestamptz)
  TO service_role;

-- A suppressed contact cannot be reactivated by the generic consent UI.
CREATE OR REPLACE FUNCTION public.set_marketing_contact_consent(
  p_contact_ids uuid[],
  p_marketing_consent boolean,
  p_action_source text,
  p_changed_by uuid
)
RETURNS TABLE (
  changed_contact_id uuid,
  result text,
  current_marketing_consent boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_contact public.marketing_contacts%ROWTYPE;
  v_campaign_id uuid;
BEGIN
  IF p_contact_ids IS NULL
     OR cardinality(p_contact_ids) = 0
     OR cardinality(p_contact_ids) > 200 THEN
    RAISE EXCEPTION 'invalid_contact_selection';
  END IF;
  IF p_marketing_consent IS NULL THEN
    RAISE EXCEPTION 'invalid_marketing_consent';
  END IF;
  IF p_action_source NOT IN ('manual_admin', 'bulk_admin') THEN
    RAISE EXCEPTION 'invalid_consent_source';
  END IF;
  IF p_changed_by IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_admins admin WHERE admin.user_id = p_changed_by
  ) THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  FOR v_contact IN
    SELECT contact.*
    FROM public.marketing_contacts contact
    WHERE contact.id = ANY(p_contact_ids)
    ORDER BY contact.id
    FOR UPDATE
  LOOP
    IF p_marketing_consent = true AND (
      v_contact.status = 'unsubscribed'
      OR v_contact.unsubscribed_at IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.marketing_unsubscribe_events unsubscribe_event
        WHERE unsubscribe_event.contact_id = v_contact.id
      )
    ) THEN
      RETURN QUERY SELECT
        v_contact.id,
        'blocked_unsubscribe_history'::text,
        v_contact.marketing_consent;
      CONTINUE;
    END IF;

    IF p_marketing_consent = true
       AND v_contact.status IN ('bounced', 'complained') THEN
      RETURN QUERY SELECT
        v_contact.id,
        'blocked_suppressed_status'::text,
        v_contact.marketing_consent;
      CONTINUE;
    END IF;

    IF v_contact.marketing_consent = p_marketing_consent THEN
      RETURN QUERY SELECT
        v_contact.id,
        'unchanged'::text,
        v_contact.marketing_consent;
      CONTINUE;
    END IF;

    UPDATE public.marketing_contacts contact
    SET marketing_consent = p_marketing_consent,
        consent_source = CASE
          WHEN p_marketing_consent THEN 'manual_admin'
          ELSE contact.consent_source
        END,
        consent_at = CASE
          WHEN p_marketing_consent THEN now()
          ELSE contact.consent_at
        END
    WHERE contact.id = v_contact.id;

    INSERT INTO public.marketing_consent_events (
      contact_id, previous_consent, new_consent, source, changed_by
    )
    VALUES (
      v_contact.id, v_contact.marketing_consent, p_marketing_consent,
      p_action_source, p_changed_by
    );

    IF p_marketing_consent = false THEN
      FOR v_campaign_id IN
        WITH skipped AS (
          UPDATE public.marketing_campaign_recipients recipient
          SET status = 'skipped',
              error_message = 'contact_no_longer_marketing_eligible',
              next_attempt_at = NULL,
              claimed_at = NULL,
              claim_token = NULL,
              updated_at = now()
          FROM public.marketing_campaigns campaign
          WHERE recipient.campaign_id = campaign.id
            AND recipient.contact_id = v_contact.id
            AND campaign.status IN ('queued', 'sending')
            AND recipient.status = 'queued'
          RETURNING recipient.campaign_id
        )
        SELECT DISTINCT skipped.campaign_id FROM skipped
      LOOP
        PERFORM public.refresh_marketing_campaign_progress(v_campaign_id);
      END LOOP;
    END IF;

    RETURN QUERY SELECT v_contact.id, 'changed'::text, p_marketing_consent;
  END LOOP;
END;
$$;

REVOKE ALL
  ON FUNCTION public.set_marketing_contact_consent(uuid[], boolean, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.set_marketing_contact_consent(uuid[], boolean, text, uuid)
  TO service_role;

-- Bring legacy campaign counters in line with the new timestamp semantics.
DO $$
DECLARE
  v_campaign_id uuid;
BEGIN
  FOR v_campaign_id IN SELECT campaign.id FROM public.marketing_campaigns campaign
  LOOP
    PERFORM public.refresh_marketing_campaign_progress(v_campaign_id);
  END LOOP;
END;
$$;

COMMIT;
