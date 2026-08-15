-- Fix PL/pgSQL ambiguity: RETURNS TABLE(contact_id) vs INSERT RETURNING contact_id
-- in claim_marketing_automation_run_batch persist_tokens CTE.

CREATE OR REPLACE FUNCTION public.claim_marketing_automation_run_batch(
  p_batch_size integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 600,
  p_max_attempts integer DEFAULT 4
)
RETURNS TABLE (
  run_id uuid,
  automation_id uuid,
  automation_key text,
  contact_id uuid,
  contact_email text,
  first_name text,
  last_name text,
  tenant_id uuid,
  user_id uuid,
  trigger_key text,
  trigger_reference text,
  attempt_count integer,
  claim_token uuid,
  unsubscribe_token text,
  template_id uuid,
  subject text,
  preview_text text,
  heading text,
  body_text text,
  image_url text,
  cta_text text,
  cta_url text,
  footer_text text,
  cta_url_type text,
  conditions jsonb,
  trial_end_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch integer := greatest(1, least(coalesce(p_batch_size, 5), 10));
  v_lease integer := greatest(60, least(coalesce(p_lease_seconds, 600), 3600));
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 4), 10));
BEGIN
  -- Recover stale processing leases.
  UPDATE public.marketing_automation_runs run
  SET status = CASE
        WHEN run.attempt_count >= v_max THEN 'failed'
        ELSE 'scheduled'
      END,
      next_attempt_at = CASE
        WHEN run.attempt_count >= v_max THEN NULL
        ELSE now()
      END,
      last_error = CASE
        WHEN run.attempt_count >= v_max THEN 'claim_lease_expired'
        ELSE run.last_error
      END,
      completed_at = CASE
        WHEN run.attempt_count >= v_max THEN coalesce(run.completed_at, now())
        ELSE NULL
      END,
      claim_token = NULL,
      claimed_at = NULL
  WHERE run.status = 'processing'
    AND run.claimed_at IS NOT NULL
    AND run.claimed_at < now() - make_interval(secs => v_lease);

  RETURN QUERY
  WITH due AS (
    SELECT run.id
    FROM public.marketing_automation_runs run
    JOIN public.marketing_automations automation
      ON automation.id = run.automation_id
    WHERE run.is_test = false
      AND automation.is_active = true
      AND run.status IN ('pending', 'scheduled')
      AND run.scheduled_for <= now()
      AND coalesce(run.next_attempt_at, run.scheduled_for) <= now()
      AND run.attempt_count < v_max
    ORDER BY coalesce(run.next_attempt_at, run.scheduled_for), run.created_at
    FOR UPDATE OF run SKIP LOCKED
    LIMIT v_batch
  ),
  claimed AS (
    UPDATE public.marketing_automation_runs run
    SET status = 'processing',
        started_at = coalesce(run.started_at, now()),
        claimed_at = now(),
        claim_token = gen_random_uuid(),
        attempt_count = run.attempt_count + 1,
        unsubscribe_token = coalesce(
          run.unsubscribe_token,
          encode(extensions.gen_random_bytes(32), 'hex')
        ),
        next_attempt_at = NULL,
        last_error = NULL
    FROM due
    WHERE run.id = due.id
    RETURNING run.*
  ),
  persist_tokens AS (
    INSERT INTO public.marketing_unsubscribe_tokens AS unsub (contact_id, token_hash)
    SELECT
      claimed.contact_id,
      encode(extensions.digest(claimed.unsubscribe_token, 'sha256'), 'hex')
    FROM claimed
    WHERE claimed.contact_id IS NOT NULL
      AND claimed.unsubscribe_token IS NOT NULL
    ON CONFLICT (token_hash) DO NOTHING
    RETURNING unsub.contact_id
  )
  SELECT
    claimed.id,
    claimed.automation_id,
    automation.automation_key,
    claimed.contact_id,
    contact.email,
    contact.first_name,
    contact.last_name,
    claimed.tenant_id,
    claimed.user_id,
    claimed.trigger_key,
    claimed.trigger_reference,
    claimed.attempt_count,
    claimed.claim_token,
    claimed.unsubscribe_token,
    template.id,
    template.subject,
    template.preview_text,
    template.heading,
    template.body_text,
    template.image_url,
    template.cta_text,
    template.cta_url,
    template.footer_text,
    template.cta_url_type,
    automation.conditions,
    subscription.trial_ends_at::date
  FROM claimed
  JOIN public.marketing_automations automation
    ON automation.id = claimed.automation_id
  JOIN public.marketing_email_templates template
    ON template.id = automation.template_id
  JOIN public.marketing_contacts contact
    ON contact.id = claimed.contact_id
  LEFT JOIN public.subscriptions subscription
    ON subscription.tenant_id = claimed.tenant_id
  LEFT JOIN persist_tokens ON persist_tokens.contact_id = claimed.contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  TO service_role;
