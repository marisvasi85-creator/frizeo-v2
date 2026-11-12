-- One controlled TikTok inbox draft for Demo Barber Salon.
-- marketing.publish.tiktok stays off. Direct Post stays inactive.
-- The draft gate is an environment flag, not a database capability.

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_status;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_status check (
    status in (
      'draft',
      'pending',
      'publishing',
      'published',
      'failed',
      'cancelled',
      'unknown',
      'released',
      'initiating'
    )
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_mode_status;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_mode_status check (
    (
      execution_mode = 'mock'
      and status = 'draft'
      and provider_post_id is null
      and provider_container_id is null
    )
    or (
      execution_mode = 'live'
      and status in (
        'pending',
        'publishing',
        'published',
        'failed',
        'cancelled',
        'unknown',
        'released',
        'initiating'
      )
    )
  );

create unique index if not exists integration_publish_jobs_tiktok_open_uidx
  on public.integration_publish_jobs (tenant_id, destination_id)
  where provider = 'tiktok'
    and execution_mode = 'live'
    and status in ('initiating', 'pending', 'publishing', 'unknown');

create table if not exists private.tiktok_media_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null,
  object_path text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint tiktok_media_grants_hash check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint tiktok_media_grants_path check (
    object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  )
);

create unique index if not exists tiktok_media_grants_hash_uidx
  on private.tiktok_media_grants (token_hash);

create or replace function public.tiktok_media_grant_insert(
  p_tenant_id uuid,
  p_token_hash text,
  p_object_path text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    raise exception 'forbidden_tenant';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token';
  end if;
  if p_object_path is null or p_object_path !~ (
    '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  ) then
    raise exception 'invalid_media';
  end if;
  if p_expires_at is null
     or p_expires_at <= pg_catalog.now()
     or p_expires_at > pg_catalog.now() + interval '20 minutes' then
    raise exception 'invalid_expiry';
  end if;

  insert into private.tiktok_media_grants (tenant_id, token_hash, object_path, expires_at)
  values (p_tenant_id, p_token_hash, p_object_path, p_expires_at);

  return jsonb_build_object('outcome', 'created');
end;
$$;

create or replace function public.tiktok_media_grant_read(
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r private.tiktok_media_grants%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('outcome', 'missing');
  end if;

  select *
    into r
    from private.tiktok_media_grants
   where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  if r.expires_at <= pg_catalog.now() then
    return jsonb_build_object('outcome', 'expired');
  end if;
  if r.object_path !~ (
    '^' || r.tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  ) then
    return jsonb_build_object('outcome', 'missing');
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'tenant_id', r.tenant_id,
    'object_path', r.object_path,
    'expires_at', r.expires_at
  );
end;
$$;

create or replace function public.tiktok_read_connection_secret(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection public.marketing_connections%rowtype;
  v_ciphertext text;
  v_nonce text;
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    return jsonb_build_object('found', false);
  end if;

  select *
    into v_connection
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'tiktok'
     and status = 'connected'
   order by updated_at desc, created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select encode(ciphertext, 'base64'), encode(nonce, 'base64')
    into v_ciphertext, v_nonce
    from private.marketing_connection_secrets
   where connection_id = v_connection.id
     and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'found', true,
    'connected_by', v_connection.connected_by,
    'scopes', to_jsonb(v_connection.scopes),
    'ciphertext', v_ciphertext,
    'nonce', v_nonce
  );
end;
$$;

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
       and status in ('initiating', 'pending', 'publishing', 'unknown')
  ) then
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

create or replace function public.tiktok_draft_settle(
  p_tenant_id uuid,
  p_job_id uuid,
  p_kind text,
  p_publish_id text,
  p_safe_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    return jsonb_build_object('outcome', 'forbidden_tenant');
  end if;

  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
     and provider = 'tiktok'
   for update;

  if not found or r.status is distinct from 'initiating' or r.execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  if p_kind = 'success' then
    if p_publish_id is null or p_publish_id !~ '^v_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$' then
      return jsonb_build_object('outcome', 'rejected');
    end if;
    update public.integration_publish_jobs
       set status = 'pending',
           provider_post_id = p_publish_id,
           safe_error = null,
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'pending', 'publish_id', p_publish_id);
  end if;

  if p_kind = 'ambiguous' then
    update public.integration_publish_jobs
       set status = 'unknown',
           provider_post_id = null,
           safe_error = 'needs_reconcile',
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'needs_reconcile');
  end if;

  if p_kind = 'rejected'
     and p_safe_error ~ '^[a-z0-9_]{1,64}$' then
    update public.integration_publish_jobs
       set status = 'failed',
           provider_post_id = null,
           safe_error = p_safe_error,
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'failed');
  end if;

  return jsonb_build_object('outcome', 'rejected');
end;
$$;

alter table private.tiktok_media_grants enable row level security;
revoke all on table private.tiktok_media_grants from public, anon, authenticated;
grant select, insert, delete on table private.tiktok_media_grants to service_role;

revoke all on function public.tiktok_media_grant_insert(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.tiktok_media_grant_read(text) from public, anon, authenticated;
revoke all on function public.tiktok_read_connection_secret(uuid) from public, anon, authenticated;
revoke all on function public.tiktok_draft_claim(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.tiktok_draft_settle(uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.tiktok_media_grant_insert(uuid, text, text, timestamptz) to service_role;
grant execute on function public.tiktok_media_grant_read(text) to service_role;
grant execute on function public.tiktok_read_connection_secret(uuid) to service_role;
grant execute on function public.tiktok_draft_claim(uuid, uuid, text, text, text) to service_role;
grant execute on function public.tiktok_draft_settle(uuid, uuid, text, text, text) to service_role;
