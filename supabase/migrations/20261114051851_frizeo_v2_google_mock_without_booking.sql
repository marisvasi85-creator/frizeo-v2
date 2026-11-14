-- Google Business mock drafts may omit the public booking link.
-- A missing link stores no Rezervă button. A present link must still be a public booking URL.
-- Markdown bold markers are removed before the draft is saved.
-- Does not call Google and does not enable live publishing.

create or replace function public.google_business_publish_prepare(
  p_tenant_id uuid,
  p_created_by uuid,
  p_idempotency_key text,
  p_caption text,
  p_media_object_path text,
  p_booking_url text,
  p_destination_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_existing integer;
  v_campaign uuid;
  v_asset uuid;
  v_jobs jsonb;
  v_caption text;
  v_booking text;
begin
  if p_tenant_id is null or p_created_by is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  v_caption := btrim(replace(coalesce(p_caption, ''), '**', ''));
  if v_caption = '' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if length(v_caption) > 1500 then
    return jsonb_build_object('outcome', 'summary_too_long');
  end if;
  v_booking := btrim(coalesce(p_booking_url, ''));
  if v_booking <> '' and (
    v_booking !~ '^https://(www\.)?frizeo\.ro/booking/[A-Za-z0-9._~%-]+([?][A-Za-z0-9._~%=&-]*)?$'
    or v_booking ~* 'staging|vercel'
  ) then
    return jsonb_build_object('outcome', 'booking_link_missing');
  end if;
  if p_media_object_path is null
     or p_media_object_path !~ (
       '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
     ) then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_destination_ids is null
     or cardinality(p_destination_ids) < 1
     or cardinality(p_destination_ids) > 5
     or (
       select count(distinct destination_id)
         from unnest(p_destination_ids) as requested(destination_id)
     ) <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select count(*)
    into v_count
    from public.marketing_destinations d
   where d.tenant_id = p_tenant_id
     and d.id = any (p_destination_ids)
     and d.provider = 'google_business'
     and d.status = 'active'
     and d.destination_type = 'google_business_location';

  if v_count <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'destination_mismatch');
  end if;

  select count(*)
    into v_existing
    from public.integration_publish_jobs
   where tenant_id = p_tenant_id
     and provider = 'google_business'
     and idempotency_key = p_idempotency_key;

  if v_existing > 0 then
    if exists (
      select 1
        from public.integration_publish_jobs j
        join public.integration_assets a
          on a.id = j.asset_id
         and a.tenant_id = j.tenant_id
       where j.tenant_id = p_tenant_id
         and j.provider = 'google_business'
         and j.idempotency_key = p_idempotency_key
         and (
           j.execution_mode is distinct from 'mock'
           or a.body is distinct from v_caption
           or a.media_object_path is distinct from p_media_object_path
           or coalesce(a.tracking->>'url', '') is distinct from v_booking
         )
    ) or exists (
      select 1
        from (
          select coalesce(array_agg(destination_id order by destination_id), '{}') as ids
            from public.integration_publish_jobs
           where tenant_id = p_tenant_id
             and provider = 'google_business'
             and idempotency_key = p_idempotency_key
        ) existing
        cross join (
          select coalesce(array_agg(destination_id order by destination_id), '{}') as ids
            from unnest(p_destination_ids) as requested_ids(destination_id)
        ) requested
       where existing.ids is distinct from requested.ids
    ) then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;

    select coalesce(jsonb_agg(public.google_business_public_job(j.id) order by j.created_at), '[]'::jsonb)
      into v_jobs
      from public.integration_publish_jobs j
     where j.tenant_id = p_tenant_id
       and j.provider = 'google_business'
       and j.idempotency_key = p_idempotency_key;

    return jsonb_build_object('outcome', 'replay', 'jobs', v_jobs);
  end if;

  insert into public.integration_campaigns (
    tenant_id,
    type,
    title,
    status,
    created_by
  ) values (
    p_tenant_id,
    'normal',
    left(v_caption, 120),
    'draft',
    p_created_by
  )
  returning id into v_campaign;

  insert into public.integration_assets (
    campaign_id,
    tenant_id,
    kind,
    format,
    channel,
    body,
    media_object_path,
    tracking,
    utm
  ) values (
    v_campaign,
    p_tenant_id,
    'image',
    'jpeg',
    'google_business',
    v_caption,
    p_media_object_path,
    case
      when v_booking = '' then '{}'::jsonb
      else jsonb_build_object('call_to_action', 'BOOK', 'url', v_booking)
    end,
    '{}'::jsonb
  )
  returning id into v_asset;

  insert into public.integration_publish_jobs (
    campaign_id,
    asset_id,
    tenant_id,
    provider,
    destination_id,
    status,
    idempotency_key,
    execution_mode,
    attempts
  )
  select
    v_campaign,
    v_asset,
    p_tenant_id,
    'google_business',
    d.id,
    'draft',
    p_idempotency_key,
    'mock',
    0
  from public.marketing_destinations d
  where d.tenant_id = p_tenant_id
    and d.provider = 'google_business'
    and d.id = any (p_destination_ids);

  select coalesce(jsonb_agg(public.google_business_public_job(j.id) order by j.created_at), '[]'::jsonb)
    into v_jobs
    from public.integration_publish_jobs j
   where j.tenant_id = p_tenant_id
     and j.provider = 'google_business'
     and j.asset_id = v_asset;

  return jsonb_build_object('outcome', 'created', 'jobs', v_jobs, 'external_call', false);
end;
$$;
