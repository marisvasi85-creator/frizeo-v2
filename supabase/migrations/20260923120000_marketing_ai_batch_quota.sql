-- Marketing AI: additive history metadata + short-transaction quota reservation.
-- Safe on a database shared with production:
--   * no DROP, DELETE, or destructive UPDATE
--   * existing rows keep working (new columns are nullable)
--   * old inserts that omit the new columns still succeed

ALTER TABLE public.marketing_ai_generations
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS extra_notes text,
  ADD COLUMN IF NOT EXISTS generation_batch_id uuid,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS variant_index smallint,
  ADD COLUMN IF NOT EXISTS context_snapshot jsonb;

CREATE INDEX IF NOT EXISTS marketing_ai_generations_batch_idx
  ON public.marketing_ai_generations (tenant_id, generation_batch_id)
  WHERE generation_batch_id IS NOT NULL;

-- One counted row per click. Lock is held only for the count+insert, never during the AI call.
CREATE OR REPLACE FUNCTION public.reserve_marketing_ai_quota(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_content_type text,
  p_provider text,
  p_usage_date date,
  p_daily_limit integer,
  p_batch_id uuid,
  p_tone text,
  p_extra_notes text,
  p_service_id uuid,
  p_channel text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('marketing_ai_quota'),
    hashtext(p_tenant_id::text || ':' || p_usage_date::text)
  );

  SELECT count(*)::integer
    INTO v_used
  FROM public.marketing_ai_generations
  WHERE tenant_id = p_tenant_id
    AND usage_date = p_usage_date
    AND counts_toward_limit = true;

  IF p_daily_limit IS NOT NULL AND v_used >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'id', NULL
    );
  END IF;

  INSERT INTO public.marketing_ai_generations (
    tenant_id,
    barber_id,
    content_type,
    provider,
    usage_date,
    counts_toward_limit,
    generation_batch_id,
    tone,
    extra_notes,
    service_id,
    channel,
    variant_index
  ) VALUES (
    p_tenant_id,
    p_barber_id,
    p_content_type,
    p_provider,
    p_usage_date,
    true,
    p_batch_id,
    p_tone,
    p_extra_notes,
    p_service_id,
    p_channel,
    0
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'id', v_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_marketing_ai_quota(
  p_id uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketing_ai_generations
  SET counts_toward_limit = false
  WHERE id = p_id
    AND tenant_id = p_tenant_id
    AND counts_toward_limit = true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_marketing_ai_quota(
  uuid, uuid, text, text, date, integer, uuid, text, text, uuid, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.release_marketing_ai_quota(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.reserve_marketing_ai_quota(
      uuid, uuid, text, text, date, integer, uuid, text, text, uuid, text
    ) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_marketing_ai_quota(uuid, uuid) TO service_role;
  END IF;
END;
$$;
