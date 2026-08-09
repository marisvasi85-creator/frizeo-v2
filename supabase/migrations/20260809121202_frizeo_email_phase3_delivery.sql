-- Frizeo Email (Phase 3): immutable launch, concurrency-safe delivery queue,
-- controlled retries and campaign progress. Additive/backward-safe only.

BEGIN;

-- ---------------------------------------------------------------------------
-- Campaign delivery state + a deliberately small controlled test audience.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS test_contact_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_audience_kind_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_audience_kind_check
  CHECK (audience_kind IN (
    'all_subscribed', 'leads', 'registered_users', 'controlled_test'
  ));

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN (
    'draft', 'scheduled', 'queued', 'sending', 'sent',
    'partially_failed', 'failed', 'cancelled'
  ));

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_test_contact_ids_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_test_contact_ids_check
  CHECK (cardinality(test_contact_ids) <= 5);

-- ---------------------------------------------------------------------------
-- Recipient lease, retry and stable unsubscribe payload state.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text;

ALTER TABLE public.marketing_campaign_recipients
  DROP CONSTRAINT IF EXISTS marketing_campaign_recipients_attempt_count_check;
ALTER TABLE public.marketing_campaign_recipients
  ADD CONSTRAINT marketing_campaign_recipients_attempt_count_check
  CHECK (attempt_count >= 0);

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_worker_ready_idx
  ON public.marketing_campaign_recipients (next_attempt_at, created_at, id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_claimed_idx
  ON public.marketing_campaign_recipients (claimed_at)
  WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS marketing_contacts_marketing_eligible_idx
  ON public.marketing_contacts (created_at, id)
  WHERE status = 'subscribed'
    AND marketing_consent = true
    AND consent_at IS NOT NULL
    AND unsubscribed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Draft snapshot. The same strict eligibility predicate is reused at launch.
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
  v_test_contact_ids uuid[];
  v_recipient_count integer;
BEGIN
  SELECT c.audience_kind, c.status, c.test_contact_ids
    INTO v_audience_kind, v_status, v_test_contact_ids
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
    AND contact.consent_at IS NOT NULL
    AND contact.unsubscribed_at IS NULL
    AND char_length(contact.email_normalized) <= 320
    AND contact.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    AND (
      v_audience_kind = 'all_subscribed'
      OR (v_audience_kind = 'leads' AND contact.user_id IS NULL)
      OR (v_audience_kind = 'registered_users' AND contact.user_id IS NOT NULL)
      OR (
        v_audience_kind = 'controlled_test'
        AND contact.id = ANY(v_test_contact_ids)
      )
    )
  ORDER BY contact.created_at ASC, contact.id ASC
  ON CONFLICT (campaign_id, email_normalized) DO NOTHING;

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

-- ---------------------------------------------------------------------------
-- Atomically re-snapshot and queue. The campaign row lock makes double-clicks
-- idempotent; the existing campaign+normalized-email unique key is the second
-- line of duplicate protection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_marketing_campaign(
  p_campaign_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.marketing_campaigns%ROWTYPE;
  v_recipient_count integer;
BEGIN
  SELECT c.*
    INTO v_campaign
  FROM public.marketing_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  IF v_campaign.status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'campaign_already_started';
  END IF;

  IF char_length(trim(v_campaign.subject)) = 0
     OR char_length(trim(v_campaign.body_text)) = 0 THEN
    RAISE EXCEPTION 'campaign_content_incomplete';
  END IF;

  IF v_campaign.audience_kind = 'controlled_test'
     AND cardinality(v_campaign.test_contact_ids) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'controlled_test_audience_invalid';
  END IF;

  DELETE FROM public.marketing_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id;

  INSERT INTO public.marketing_campaign_recipients (
    campaign_id,
    contact_id,
    email,
    first_name,
    last_name,
    status,
    queued_at,
    next_attempt_at,
    unsubscribe_token
  )
  SELECT
    p_campaign_id,
    contact.id,
    contact.email,
    contact.first_name,
    contact.last_name,
    'queued',
    now(),
    now(),
    encode(extensions.gen_random_bytes(32), 'hex')
  FROM public.marketing_contacts contact
  WHERE contact.status = 'subscribed'
    AND contact.marketing_consent = true
    AND contact.consent_at IS NOT NULL
    AND contact.unsubscribed_at IS NULL
    AND char_length(contact.email_normalized) <= 320
    AND contact.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    AND (
      v_campaign.audience_kind = 'all_subscribed'
      OR (v_campaign.audience_kind = 'leads' AND contact.user_id IS NULL)
      OR (
        v_campaign.audience_kind = 'registered_users'
        AND contact.user_id IS NOT NULL
      )
      OR (
        v_campaign.audience_kind = 'controlled_test'
        AND contact.id = ANY(v_campaign.test_contact_ids)
      )
    )
  ORDER BY contact.created_at ASC, contact.id ASC
  ON CONFLICT (campaign_id, email_normalized) DO NOTHING;

  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'campaign_audience_empty';
  END IF;

  INSERT INTO public.marketing_unsubscribe_tokens (contact_id, token_hash)
  SELECT
    r.contact_id,
    encode(extensions.digest(r.unsubscribe_token, 'sha256'), 'hex')
  FROM public.marketing_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id
    AND r.contact_id IS NOT NULL
    AND r.unsubscribe_token IS NOT NULL
  ON CONFLICT (token_hash) DO NOTHING;

  UPDATE public.marketing_campaigns
  SET status = 'queued',
      recipient_count = v_recipient_count,
      sent_count = 0,
      failed_count = 0,
      audience_snapshot_at = now(),
      queued_at = now(),
      started_at = NULL,
      completed_at = NULL,
      failed_at = NULL,
      sent_at = NULL
  WHERE id = p_campaign_id;

  RETURN v_recipient_count;
END;
$$;

REVOKE ALL
  ON FUNCTION public.queue_marketing_campaign(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.queue_marketing_campaign(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Keep materialized counters/status in sync after every terminal or retry
-- transition. Phase 4 delivery statuses are counted as sent for compatibility.
-- ---------------------------------------------------------------------------
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
    count(*) FILTER (
      WHERE r.status IN ('sent', 'delivered', 'opened', 'clicked')
    )::integer,
    count(*) FILTER (WHERE r.status = 'failed')::integer,
    count(*) FILTER (WHERE r.status = 'skipped')::integer
    INTO v_total, v_active, v_sent, v_failed, v_skipped
  FROM public.marketing_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id;

  UPDATE public.marketing_campaigns c
  SET recipient_count = v_total,
      sent_count = v_sent,
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

-- ---------------------------------------------------------------------------
-- Non-blocking atomic claim. External provider calls happen after this short
-- transaction commits, so Postgres locks are never held during network I/O.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_marketing_recipient_batch(
  p_batch_size integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 600,
  p_max_attempts integer DEFAULT 4
)
RETURNS TABLE (
  recipient_id uuid,
  campaign_id uuid,
  contact_id uuid,
  recipient_email text,
  first_name text,
  last_name text,
  unsubscribe_token text,
  attempt_count integer,
  claim_token uuid,
  subject text,
  preview_text text,
  heading text,
  body_text text,
  image_url text,
  cta_text text,
  cta_url text,
  footer_text text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  -- Recover a crashed worker only while the provider idempotency window is safe.
  UPDATE public.marketing_campaign_recipients r
  SET status = CASE
        WHEN r.attempt_count >= greatest(1, least(p_max_attempts, 10))
          OR r.first_attempt_at < now() - interval '23 hours'
          THEN 'failed'
        ELSE 'queued'
      END,
      failed_at = CASE
        WHEN r.attempt_count >= greatest(1, least(p_max_attempts, 10))
          OR r.first_attempt_at < now() - interval '23 hours'
          THEN now()
        ELSE r.failed_at
      END,
      next_attempt_at = CASE
        WHEN r.attempt_count >= greatest(1, least(p_max_attempts, 10))
          OR r.first_attempt_at < now() - interval '23 hours'
          THEN NULL
        ELSE now()
      END,
      error_message = CASE
        WHEN r.first_attempt_at < now() - interval '23 hours'
          THEN 'claim_expired_after_provider_idempotency_window'
        WHEN r.attempt_count >= greatest(1, least(p_max_attempts, 10))
          THEN 'maximum_attempts_reached'
        ELSE 'stale_worker_claim_recovered'
      END,
      claimed_at = NULL,
      claim_token = NULL
  FROM public.marketing_campaigns c
  WHERE r.campaign_id = c.id
    AND c.status IN ('queued', 'sending')
    AND r.status = 'sending'
    AND (
      r.claimed_at IS NULL
      OR r.claimed_at < now() - make_interval(
        secs => greatest(60, least(p_lease_seconds, 3600))
      )
    );

  -- A later unsubscribe/complaint suppresses delivery but does not mutate the
  -- immutable snapshot identity/email.
  UPDATE public.marketing_campaign_recipients r
  SET status = 'skipped',
      error_message = 'contact_no_longer_marketing_eligible',
      next_attempt_at = NULL,
      claimed_at = NULL,
      claim_token = NULL
  FROM public.marketing_campaigns c
  WHERE r.campaign_id = c.id
    AND c.status IN ('queued', 'sending')
    AND r.status = 'queued'
    AND NOT EXISTS (
      SELECT 1
      FROM public.marketing_contacts contact
      WHERE contact.id = r.contact_id
        AND contact.status = 'subscribed'
        AND contact.marketing_consent = true
        AND contact.consent_at IS NOT NULL
        AND contact.unsubscribed_at IS NULL
    );

  UPDATE public.marketing_campaign_recipients r
  SET status = 'failed',
      failed_at = now(),
      error_message = 'maximum_attempts_reached',
      next_attempt_at = NULL
  FROM public.marketing_campaigns c
  WHERE r.campaign_id = c.id
    AND c.status IN ('queued', 'sending')
    AND r.status = 'queued'
    AND r.attempt_count >= greatest(1, least(p_max_attempts, 10));

  FOR v_campaign_id IN
    SELECT c.id
    FROM public.marketing_campaigns c
    WHERE c.status IN ('queued', 'sending')
    ORDER BY c.id
  LOOP
    PERFORM public.refresh_marketing_campaign_progress(v_campaign_id);
  END LOOP;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.id
    FROM public.marketing_campaign_recipients r
    JOIN public.marketing_campaigns c ON c.id = r.campaign_id
    WHERE c.status IN ('queued', 'sending')
      AND r.status = 'queued'
      AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= now())
      AND r.attempt_count < greatest(1, least(p_max_attempts, 10))
    ORDER BY c.queued_at ASC NULLS LAST, r.created_at ASC, r.id ASC
    LIMIT greatest(1, least(p_batch_size, 10))
    FOR UPDATE OF r SKIP LOCKED
  ), claimed AS (
    UPDATE public.marketing_campaign_recipients r
    SET status = 'sending',
        attempt_count = r.attempt_count + 1,
        first_attempt_at = coalesce(r.first_attempt_at, now()),
        last_attempt_at = now(),
        claimed_at = now(),
        claim_token = gen_random_uuid(),
        error_message = NULL
    FROM candidates candidate
    WHERE r.id = candidate.id
    RETURNING r.*
  ), started AS (
    UPDATE public.marketing_campaigns c
    SET status = 'sending',
        started_at = coalesce(c.started_at, now())
    WHERE c.id IN (SELECT DISTINCT claimed.campaign_id FROM claimed)
      AND c.status IN ('queued', 'sending')
    RETURNING c.id
  )
  SELECT
    claimed.id,
    claimed.campaign_id,
    claimed.contact_id,
    claimed.email,
    claimed.first_name,
    claimed.last_name,
    claimed.unsubscribe_token,
    claimed.attempt_count,
    claimed.claim_token,
    c.subject,
    c.preview_text,
    c.heading,
    c.body_text,
    c.image_url,
    c.cta_text,
    c.cta_url,
    c.footer_text
  FROM claimed
  JOIN started ON started.id = claimed.campaign_id
  JOIN public.marketing_campaigns c ON c.id = claimed.campaign_id
  ORDER BY claimed.created_at ASC, claimed.id ASC;
END;
$$;

REVOKE ALL
  ON FUNCTION public.claim_marketing_recipient_batch(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.claim_marketing_recipient_batch(integer, integer, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Conditional result recording. A late worker cannot overwrite a newer claim.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_marketing_recipient_result(
  p_recipient_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_provider_message_id text DEFAULT NULL,
  p_temporary boolean DEFAULT false,
  p_error_message text DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 60,
  p_max_attempts integer DEFAULT 4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign_id uuid;
  v_attempt_count integer;
BEGIN
  SELECT r.campaign_id, r.attempt_count
    INTO v_campaign_id, v_attempt_count
  FROM public.marketing_campaign_recipients r
  WHERE r.id = p_recipient_id
    AND r.status = 'sending'
    AND r.claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_success THEN
    IF p_provider_message_id IS NULL OR char_length(trim(p_provider_message_id)) = 0 THEN
      RAISE EXCEPTION 'provider_message_id_required';
    END IF;

    UPDATE public.marketing_campaign_recipients r
    SET status = 'sent',
        provider = 'resend',
        provider_message_id = p_provider_message_id,
        sent_at = now(),
        failed_at = NULL,
        error_message = NULL,
        next_attempt_at = NULL,
        claimed_at = NULL,
        claim_token = NULL
    WHERE r.id = p_recipient_id;
  ELSIF p_temporary
        AND v_attempt_count < greatest(1, least(p_max_attempts, 10)) THEN
    UPDATE public.marketing_campaign_recipients r
    SET status = 'queued',
        error_message = left(coalesce(p_error_message, 'temporary_provider_error'), 1000),
        next_attempt_at = now() + make_interval(
          secs => greatest(15, least(p_retry_delay_seconds, 86400))
        ),
        claimed_at = NULL,
        claim_token = NULL
    WHERE r.id = p_recipient_id;
  ELSE
    UPDATE public.marketing_campaign_recipients r
    SET status = 'failed',
        failed_at = now(),
        error_message = left(coalesce(p_error_message, 'permanent_provider_error'), 1000),
        next_attempt_at = NULL,
        claimed_at = NULL,
        claim_token = NULL
    WHERE r.id = p_recipient_id;
  END IF;

  PERFORM public.refresh_marketing_campaign_progress(v_campaign_id);
  RETURN true;
END;
$$;

REVOKE ALL
  ON FUNCTION public.record_marketing_recipient_result(
    uuid, uuid, boolean, text, boolean, text, integer, integer
  )
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.record_marketing_recipient_result(
    uuid, uuid, boolean, text, boolean, text, integer, integer
  )
  TO service_role;

-- ---------------------------------------------------------------------------
-- Optional safe cancellation. Already-sent rows stay sent; active provider
-- calls may finish, but no new queued row can be claimed afterwards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_marketing_campaign(
  p_campaign_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT c.status
    INTO v_status
  FROM public.marketing_campaigns c
  WHERE c.id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign_not_found';
  END IF;

  IF v_status NOT IN ('queued', 'sending') THEN
    RETURN false;
  END IF;

  UPDATE public.marketing_campaigns
  SET status = 'cancelled',
      completed_at = coalesce(completed_at, now())
  WHERE id = p_campaign_id;

  UPDATE public.marketing_campaign_recipients
  SET status = 'skipped',
      error_message = 'campaign_cancelled',
      next_attempt_at = NULL,
      claimed_at = NULL,
      claim_token = NULL
  WHERE campaign_id = p_campaign_id
    AND status IN ('pending', 'queued');

  RETURN true;
END;
$$;

REVOKE ALL
  ON FUNCTION public.cancel_marketing_campaign(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION public.cancel_marketing_campaign(uuid)
  TO service_role;

COMMIT;
