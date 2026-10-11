-- Null bytes cannot be represented in Postgres text.
-- Caption length stays enforced here. The application rejects a null byte before the call.

create or replace function public.meta_publish_prepare(
  p_tenant_id uuid,
  p_created_by uuid,
  p_idempotency_key text,
  p_caption text,
  p_media_object_path text,
  p_destination_ids uuid[],
  p_execution_mode text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_types integer;
  v_existing integer;
  v_campaign uuid;
  v_asset uuid;
  v_jobs jsonb;
begin
  if p_tenant_id is null or p_created_by is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_caption is null or length(p_caption) > 2200 then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_execution_mode is distinct from 'mock' and p_execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_media_object_path is null
     or p_media_object_path !~ (
       '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
     ) then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_destination_ids is null
     or cardinality(p_destination_ids) < 1
     or cardinality(p_destination_ids) > 2
     or (
       select count(distinct destination_id)
         from unnest(p_destination_ids) as ids(destination_id)
     ) <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':publish:' || p_idempotency_key, 42)
  );

  select count(*)
    into v_count
    from public.marketing_destinations d
   where d.tenant_id = p_tenant_id
     and d.id = any (p_destination_ids)
     and d.provider = 'meta'
     and d.status = 'active'
     and d.destination_type in ('facebook_page', 'instagram_business');

  if v_count <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'destination_mismatch');
  end if;

  select count(distinct d.destination_type)
    into v_types
    from public.marketing_destinations d
   where d.tenant_id = p_tenant_id
     and d.id = any (p_destination_ids);

  if v_types <> v_count then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select count(*)
    into v_existing
    from public.integration_publish_jobs
   where tenant_id = p_tenant_id
     and idempotency_key = p_idempotency_key;

  if v_existing > 0 then
    if exists (
      select 1
        from public.integration_publish_jobs j
        join public.integration_assets a
          on a.id = j.asset_id
         and a.tenant_id = j.tenant_id
       where j.tenant_id = p_tenant_id
         and j.idempotency_key = p_idempotency_key
         and (
           j.execution_mode is distinct from p_execution_mode
           or a.body is distinct from p_caption
           or a.media_object_path is distinct from p_media_object_path
         )
    ) or exists (
      select 1
        from (
          select coalesce(array_agg(destination_id order by destination_id), '{}') as ids
            from public.integration_publish_jobs
           where tenant_id = p_tenant_id
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

    select coalesce(jsonb_agg(public.meta_publish_public_job(j.id) order by j.created_at), '[]'::jsonb)
      into v_jobs
      from public.integration_publish_jobs j
     where j.tenant_id = p_tenant_id
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
    case
      when length(btrim(p_caption)) = 0 then 'Publicare Meta'
      else left(btrim(p_caption), 120)
    end,
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
    'meta',
    p_caption,
    p_media_object_path,
    '{}'::jsonb,
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
    'meta',
    d.id,
    case when p_execution_mode = 'live' then 'pending' else 'draft' end,
    p_idempotency_key,
    p_execution_mode,
    0
  from public.marketing_destinations d
  where d.tenant_id = p_tenant_id
    and d.id = any (p_destination_ids);

  select coalesce(jsonb_agg(public.meta_publish_public_job(j.id) order by j.created_at), '[]'::jsonb)
    into v_jobs
    from public.integration_publish_jobs j
   where j.tenant_id = p_tenant_id
     and j.asset_id = v_asset;

  return jsonb_build_object('outcome', 'created', 'jobs', v_jobs);
end;
$$;

