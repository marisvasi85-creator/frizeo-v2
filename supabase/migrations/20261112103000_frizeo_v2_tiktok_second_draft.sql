-- Allow one new TikTok inbox test beside a single unidentified unknown job.
-- Does not update or retry an existing job.

drop index if exists public.integration_publish_jobs_tiktok_open_uidx;

create unique index integration_publish_jobs_tiktok_open_uidx
  on public.integration_publish_jobs (tenant_id, destination_id)
  where provider = 'tiktok'
    and execution_mode = 'live'
    and status in ('initiating', 'pending', 'publishing');

create or replace function public.tiktok_draft_claim(
  p_tenant_id uuid,
  p_created_by uuid,
  p_idempotency_key text,
  p_caption text,
  p_media_object_path text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection_id uuid;
  v_open_id text;
  v_display_name text;
  v_scopes text[];
  v_connected_by uuid;
  v_destination uuid;
  v_job uuid;
  v_status text;
  v_publish text;
  v_campaign uuid;
  v_asset uuid;
  v_unknown integer;
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    return jsonb_build_object('outcome', 'forbidden_tenant', 'external_call', false);
  end if;
  if p_created_by is null or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid', 'external_call', false);
  end if;
  if p_caption is null or length(btrim(p_caption)) = 0 or length(p_caption) > 4000 then
    return jsonb_build_object('outcome', 'invalid', 'external_call', false);
  end if;
  if p_media_object_path is null or p_media_object_path !~ (
    '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  ) then
    return jsonb_build_object('outcome', 'invalid', 'external_call', false);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':tiktok-draft', 42)
  );

  select id, provider_account_id, display_name, scopes, connected_by
    into v_connection_id, v_open_id, v_display_name, v_scopes, v_connected_by
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
     and status = 'connected'
   order by updated_at desc, created_at desc
   limit 1;

  if v_connection_id is null then
    return jsonb_build_object('outcome', 'connection_missing', 'external_call', false);
  end if;
  if v_connected_by is distinct from p_created_by then
    return jsonb_build_object('outcome', 'forbidden_tenant', 'external_call', false);
  end if;
  if 'video.publish' = any (v_scopes) then
    return jsonb_build_object('outcome', 'direct_post_inactive', 'external_call', false);
  end if;
  if not ('user.info.basic' = any (v_scopes)) or not ('video.upload' = any (v_scopes)) then
    return jsonb_build_object('outcome', 'upload_scope_required', 'external_call', false);
  end if;

  select j.id, j.status, j.provider_post_id
    into v_job, v_status, v_publish
    from public.integration_publish_jobs j
   where j.tenant_id = p_tenant_id
     and j.provider = 'tiktok'
     and j.idempotency_key = p_idempotency_key
   order by j.created_at
   limit 1;

  if v_job is not null then
    if exists (
      select 1
        from public.integration_publish_jobs j
        join public.integration_assets a
          on a.id = j.asset_id
         and a.tenant_id = j.tenant_id
       where j.id = v_job
         and (
           a.body is distinct from btrim(p_caption)
           or a.media_object_path is distinct from p_media_object_path
         )
    ) then
      return jsonb_build_object('outcome', 'conflict', 'external_call', false);
    end if;
    return jsonb_build_object(
      'outcome', 'replay',
      'job_id', v_job,
      'status', v_status,
      'publish_id', v_publish,
      'external_call', false
    );
  end if;

  select id
    into v_destination
    from public.marketing_destinations
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
     and destination_type = 'tiktok_account'
     and provider_destination_id = v_open_id
   limit 1;

  if v_destination is null then
    insert into public.marketing_destinations (
      connection_id, tenant_id, provider, destination_type, provider_destination_id,
      display_name, metadata, status
    ) values (
      v_connection_id, p_tenant_id, 'tiktok', 'tiktok_account', v_open_id,
      coalesce(nullif(btrim(v_display_name), ''), 'Cont TikTok'),
      jsonb_build_object('post_mode', 'MEDIA_UPLOAD', 'media_type', 'PHOTO'),
      'active'
    )
    returning id into v_destination;
  end if;

  if exists (
    select 1
      from public.integration_publish_jobs
     where tenant_id = p_tenant_id
       and destination_id = v_destination
       and provider = 'tiktok'
       and execution_mode = 'live'
       and status in ('initiating', 'pending', 'publishing')
  ) then
    return jsonb_build_object('outcome', 'busy', 'external_call', false);
  end if;

  if exists (
    select 1
      from public.integration_publish_jobs
     where tenant_id = p_tenant_id
       and destination_id = v_destination
       and provider = 'tiktok'
       and execution_mode = 'live'
       and status = 'unknown'
       and provider_post_id is not null
  ) then
    return jsonb_build_object('outcome', 'busy', 'external_call', false);
  end if;

  select count(*)
    into v_unknown
    from public.integration_publish_jobs
   where tenant_id = p_tenant_id
     and destination_id = v_destination
     and provider = 'tiktok'
     and execution_mode = 'live'
     and status = 'unknown'
     and provider_post_id is null;

  if v_unknown >= 2 then
    return jsonb_build_object('outcome', 'busy', 'external_call', false);
  end if;

  insert into public.integration_campaigns (
    tenant_id, type, title, status, created_by
  ) values (
    p_tenant_id, 'normal', left(btrim(p_caption), 120), 'draft', p_created_by
  )
  returning id into v_campaign;

  insert into public.integration_assets (
    campaign_id, tenant_id, kind, format, channel, body, media_object_path, tracking, utm
  ) values (
    v_campaign, p_tenant_id, 'image', 'jpeg', 'tiktok', btrim(p_caption), p_media_object_path,
    jsonb_build_object('post_mode', 'MEDIA_UPLOAD', 'media_type', 'PHOTO'), '{}'::jsonb
  )
  returning id into v_asset;

  insert into public.integration_publish_jobs (
    campaign_id, asset_id, tenant_id, provider, destination_id, status,
    idempotency_key, execution_mode, attempts, safe_error
  ) values (
    v_campaign, v_asset, p_tenant_id, 'tiktok', v_destination, 'initiating',
    p_idempotency_key, 'live', 1, null
  )
  returning id into v_job;

  return jsonb_build_object(
    'outcome', 'claimed',
    'job_id', v_job,
    'status', 'initiating',
    'external_call', false
  );
end;
$$;
