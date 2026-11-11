-- TikTok Content Posting preparation. Mock drafts only.
-- Does not enable marketing.publish.tiktok and does not call TikTok.
-- Meta and Google Business functions stay as they are.

drop function if exists public.tiktok_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint);

create or replace function public.tiktok_upsert_connection(
  p_tenant_id uuid,
  p_provider_account_id text,
  p_display_name text,
  p_status text,
  p_scopes text[],
  p_upload_consent boolean,
  p_direct_post_consent boolean,
  p_connected_by uuid,
  p_token_expires_at timestamptz,
  p_last_error text,
  p_ciphertext text,
  p_nonce text,
  p_key_version smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_status is distinct from 'connected' then
    raise exception 'invalid_connection_status';
  end if;
  if p_provider_account_id is null or p_provider_account_id !~ '^[A-Za-z0-9._-]{2,128}$' then
    raise exception 'provider_account_required';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) = 0 or length(p_display_name) > 120 then
    raise exception 'invalid_display_name';
  end if;
  if p_ciphertext is null or p_nonce is null then
    raise exception 'secret_required';
  end if;
  if p_scopes is null or not ('user.info.basic' = any (p_scopes)) then
    raise exception 'scope_required';
  end if;
  if exists (
    select 1
      from unnest(p_scopes) as scope
     where scope not in ('user.info.basic', 'video.upload', 'video.publish')
  ) then
    raise exception 'scope_rejected';
  end if;
  if 'video.upload' = any (p_scopes) and p_upload_consent is distinct from true then
    raise exception 'upload_consent_required';
  end if;
  if 'video.publish' = any (p_scopes) or p_direct_post_consent is true then
    raise exception 'direct_post_inactive';
  end if;
  if p_token_expires_at is null or p_token_expires_at <= pg_catalog.now() then
    raise exception 'token_expiry_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':tiktok', 42)
  );

  select id
    into v_id
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
   order by updated_at desc, created_at desc
   limit 1
   for update;

  if v_id is null then
    insert into public.marketing_connections (
      tenant_id,
      provider,
      provider_account_id,
      display_name,
      status,
      scopes,
      connected_by,
      connected_at,
      token_expires_at,
      last_validated_at,
      last_error
    ) values (
      p_tenant_id,
      'tiktok',
      p_provider_account_id,
      btrim(p_display_name),
      'connected',
      p_scopes,
      p_connected_by,
      pg_catalog.now(),
      p_token_expires_at,
      pg_catalog.now(),
      null
    )
    returning id into v_id;
  else
    update public.marketing_connections
       set provider_account_id = p_provider_account_id,
           display_name = btrim(p_display_name),
           status = 'connected',
           scopes = p_scopes,
           connected_by = p_connected_by,
           connected_at = coalesce(connected_at, pg_catalog.now()),
           token_expires_at = p_token_expires_at,
           last_validated_at = pg_catalog.now(),
           last_error = null,
           updated_at = pg_catalog.now()
     where id = v_id
       and tenant_id = p_tenant_id
       and provider = 'tiktok';
  end if;

  insert into private.marketing_connection_secrets (
    connection_id,
    tenant_id,
    ciphertext,
    nonce,
    key_version,
    updated_at
  ) values (
    v_id,
    p_tenant_id,
    decode(p_ciphertext, 'base64'),
    decode(p_nonce, 'base64'),
    coalesce(p_key_version, 1),
    pg_catalog.now()
  )
  on conflict (connection_id) do update
    set ciphertext = excluded.ciphertext,
        nonce = excluded.nonce,
        key_version = excluded.key_version,
        tenant_id = excluded.tenant_id,
        updated_at = pg_catalog.now();

  return jsonb_build_object('id', v_id, 'status', 'connected');
end;
$$;

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_provider_ids;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_provider_ids check (
    (
      provider_post_id is null
      or provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
      or provider_post_id ~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$'
      or provider_post_id ~ '^v_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$'
    )
    and (provider_container_id is null or provider_container_id ~ '^[0-9]{1,32}$')
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_published_post;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_published_post check (
    status <> 'published'
    or (
      provider_post_id is not null
      and (
        provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
        or provider_post_id ~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$'
        or provider_post_id ~ '^v_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$'
      )
    )
  );

create or replace function public.tiktok_publish_prepare(
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
  v_destination uuid;
  v_existing integer;
  v_campaign uuid;
  v_asset uuid;
  v_job uuid;
begin
  if p_tenant_id is null or p_created_by is null then
    return jsonb_build_object('outcome', 'invalid', 'external_call', false);
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid', 'external_call', false);
  end if;
  if p_caption is null or length(btrim(p_caption)) = 0 or length(p_caption) > 4000 then
    return jsonb_build_object('outcome', 'invalid_caption', 'external_call', false);
  end if;
  if p_media_object_path is null
     or p_media_object_path !~ (
       '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
     ) then
    return jsonb_build_object('outcome', 'invalid_media', 'external_call', false);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':tiktok', 42)
  );

  select id, provider_account_id, display_name, scopes
    into v_connection_id, v_open_id, v_display_name, v_scopes
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
     and status = 'connected'
   order by updated_at desc, created_at desc
   limit 1;

  if v_connection_id is null then
    return jsonb_build_object('outcome', 'connection_missing', 'external_call', false);
  end if;
  if not ('user.info.basic' = any (v_scopes)) or not ('video.upload' = any (v_scopes)) then
    return jsonb_build_object('outcome', 'upload_scope_required', 'external_call', false);
  end if;
  if 'video.publish' = any (v_scopes) then
    return jsonb_build_object('outcome', 'direct_post_inactive', 'external_call', false);
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
      connection_id,
      tenant_id,
      provider,
      destination_type,
      provider_destination_id,
      display_name,
      metadata,
      status
    ) values (
      v_connection_id,
      p_tenant_id,
      'tiktok',
      'tiktok_account',
      v_open_id,
      coalesce(nullif(btrim(v_display_name), ''), 'Cont TikTok'),
      jsonb_build_object('post_mode', 'MEDIA_UPLOAD', 'media_type', 'PHOTO'),
      'active'
    )
    returning id into v_destination;
  end if;

  select count(*)
    into v_existing
    from public.integration_publish_jobs
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
     and idempotency_key = p_idempotency_key;

  if v_existing > 0 then
    if exists (
      select 1
        from public.integration_publish_jobs j
        join public.integration_assets a
          on a.id = j.asset_id
         and a.tenant_id = j.tenant_id
       where j.tenant_id = p_tenant_id
         and j.provider = 'tiktok'
         and j.idempotency_key = p_idempotency_key
         and (
           j.execution_mode is distinct from 'mock'
           or j.status is distinct from 'draft'
           or j.provider_post_id is not null
           or a.body is distinct from btrim(p_caption)
           or a.media_object_path is distinct from p_media_object_path
         )
    ) then
      return jsonb_build_object('outcome', 'idempotency_conflict', 'external_call', false);
    end if;

    select j.id
      into v_job
      from public.integration_publish_jobs j
     where j.tenant_id = p_tenant_id
       and j.provider = 'tiktok'
       and j.idempotency_key = p_idempotency_key
     order by j.created_at
     limit 1;

    return jsonb_build_object('outcome', 'replay', 'job_id', v_job, 'external_call', false);
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
    left(btrim(p_caption), 120),
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
    'tiktok',
    btrim(p_caption),
    p_media_object_path,
    jsonb_build_object('post_mode', 'MEDIA_UPLOAD', 'media_type', 'PHOTO'),
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
  ) values (
    v_campaign,
    v_asset,
    p_tenant_id,
    'tiktok',
    v_destination,
    'draft',
    p_idempotency_key,
    'mock',
    0
  )
  returning id into v_job;

  return jsonb_build_object('outcome', 'created', 'job_id', v_job, 'external_call', false);
end;
$$;

revoke all on function public.tiktok_upsert_connection(uuid, text, text, text, text[], boolean, boolean, uuid, timestamptz, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.tiktok_publish_prepare(uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.tiktok_upsert_connection(uuid, text, text, text, text[], boolean, boolean, uuid, timestamptz, text, text, text, smallint) to service_role;
grant execute on function public.tiktok_publish_prepare(uuid, uuid, text, text, text) to service_role;
