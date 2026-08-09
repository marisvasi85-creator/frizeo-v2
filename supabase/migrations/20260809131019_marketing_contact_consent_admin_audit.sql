BEGIN;

-- Immutable audit trail for explicit platform-admin consent changes.
CREATE TABLE public.marketing_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL
    REFERENCES public.marketing_contacts (id) ON DELETE CASCADE,
  previous_consent boolean NOT NULL,
  new_consent boolean NOT NULL,
  source text NOT NULL
    CHECK (source IN ('manual_admin', 'bulk_admin')),
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketing_consent_events_contact_created_idx
  ON public.marketing_consent_events (contact_id, created_at DESC);
CREATE INDEX marketing_consent_events_changed_by_idx
  ON public.marketing_consent_events (changed_by)
  WHERE changed_by IS NOT NULL;

ALTER TABLE public.marketing_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_consent_events_platform_admin_select"
ON public.marketing_consent_events
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

REVOKE ALL ON public.marketing_consent_events FROM anon, authenticated;
GRANT SELECT ON public.marketing_consent_events TO authenticated;
GRANT SELECT, INSERT ON public.marketing_consent_events TO service_role;

-- One short transaction updates contacts and records audit rows. The function
-- is callable only by the server-side service role; the API separately verifies
-- the platform-admin session and passes that user's id as changed_by.
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
    SELECT 1
    FROM public.platform_admins admin
    WHERE admin.user_id = p_changed_by
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
      contact_id,
      previous_consent,
      new_consent,
      source,
      changed_by
    )
    VALUES (
      v_contact.id,
      v_contact.marketing_consent,
      p_marketing_consent,
      p_action_source,
      p_changed_by
    );

    -- Removing consent immediately suppresses recipients which have not yet
    -- been claimed by a worker. The claim function also rechecks eligibility.
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
        SELECT DISTINCT skipped.campaign_id
        FROM skipped
      LOOP
        PERFORM public.refresh_marketing_campaign_progress(v_campaign_id);
      END LOOP;
    END IF;

    RETURN QUERY SELECT
      v_contact.id,
      'changed'::text,
      p_marketing_consent;
  END LOOP;
END;
$$;

REVOKE ALL
  ON FUNCTION public.set_marketing_contact_consent(uuid[], boolean, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.set_marketing_contact_consent(uuid[], boolean, text, uuid)
  TO service_role;

COMMIT;
