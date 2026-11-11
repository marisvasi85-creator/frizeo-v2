-- Google Business Profile on staging. Meta functions stay as they are.
-- Post ids may be a Meta numeric id or a Google local-post resource name.
-- Live rows are not created here: the prepare function accepts mock only.

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_provider_ids;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_provider_ids check (
    (
      provider_post_id is null
      or provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
      or provider_post_id ~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$'
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
      )
    )
  );

create or replace function public.integration_oauth_state_consume(
  p_state_hash text,
  p_provider text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r private.integration_oauth_states%rowtype;
begin
  if p_provider is distinct from 'meta' and p_provider is distinct from 'google_business' then
    return jsonb_build_object('outcome', 'provider_mismatch');
  end if;

  select *
    into r
    from private.integration_oauth_states
   where state_hash = p_state_hash
   for update;

  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;

  if r.provider is distinct from p_provider then
    return jsonb_build_object('outcome', 'provider_mismatch');
  end if;

  if r.consumed_at is not null then
    return jsonb_build_object('outcome', 'consumed');
  end if;

  update private.integration_oauth_states
     set consumed_at = pg_catalog.now()
   where id = r.id;

  if r.expires_at <= pg_catalog.now() then
    return jsonb_build_object('outcome', 'expired');
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'tenant_id', r.tenant_id,
    'user_id', r.user_id,
    'provider', r.provider,
    'expires_at', r.expires_at,
    'pkce_ciphertext', encode(r.pkce_ciphertext, 'base64'),
    'pkce_nonce', encode(r.pkce_nonce, 'base64')
  );
end;
$$;

create or replace function public.google_business_oauth_state_insert(
  p_tenant_id uuid,
  p_user_id uuid,
  p_state_hash text,
  p_pkce_ciphertext text,
  p_pkce_nonce text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_state_hash is null or length(btrim(p_state_hash)) = 0 then
    raise exception 'oauth_state_invalid';
  end if;
  if p_pkce_ciphertext is null or p_pkce_nonce is null then
    raise exception 'oauth_state_invalid';
  end if;

  insert into private.integration_oauth_states (
    tenant_id,
    user_id,
    provider,
    state_hash,
    pkce_ciphertext,
    pkce_nonce,
    expires_at
  ) values (
    p_tenant_id,
    p_user_id,
    'google_business',
    p_state_hash,
    decode(p_pkce_ciphertext, 'base64'),
    decode(p_pkce_nonce, 'base64'),
    p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.google_business_upsert_connection(
  p_tenant_id uuid,
  p_provider_account_id text,
  p_display_name text,
  p_status text,
  p_scopes text[],
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
  if p_status not in (
    'not_connected',
    'connected',
    'needs_reconnect',
    'error',
    'setup_required'
  ) then
    raise exception 'invalid_connection_status';
  end if;
  if p_provider_account_id is null or p_provider_account_id !~ '^accounts/[0-9]{1,30}$' then
    raise exception 'provider_account_required';
  end if;
  if p_ciphertext is null or p_nonce is null then
    raise exception 'secret_required';
  end if;
  if p_scopes is null or not ('https://www.googleapis.com/auth/business.manage' = any (p_scopes)) then
    raise exception 'scope_required';
  end if;
  if exists (
    select 1
      from unnest(p_scopes) as scope
     where scope ilike '%calendar%'
  ) then
    raise exception 'calendar_scope_rejected';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':google_business', 42)
  );

  select id
    into v_id
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'google_business'
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
      'google_business',
      p_provider_account_id,
      p_display_name,
      p_status,
      coalesce(p_scopes, '{}'),
      p_connected_by,
      case when p_status = 'connected' then pg_catalog.now() else null end,
      p_token_expires_at,
      pg_catalog.now(),
      p_last_error
    )
    returning id into v_id;
  else
    update public.marketing_connections
       set provider_account_id = p_provider_account_id,
           display_name = p_display_name,
           status = p_status,
           scopes = coalesce(p_scopes, '{}'),
           connected_by = p_connected_by,
           connected_at = case
             when p_status = 'connected' then coalesce(connected_at, pg_catalog.now())
             else null
           end,
           token_expires_at = p_token_expires_at,
           last_validated_at = pg_catalog.now(),
           last_error = p_last_error,
           updated_at = pg_catalog.now()
     where id = v_id
       and tenant_id = p_tenant_id
       and provider = 'google_business';
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

  return jsonb_build_object('id', v_id, 'status', p_status);
end;
$$;

create or replace function public.google_business_replace_destinations(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_destinations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  elem jsonb;
  v_destination_id text;
  v_name text;
  v_account text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':google_business', 42)
  );

  if not exists (
    select 1
      from public.marketing_connections
     where id = p_connection_id
       and tenant_id = p_tenant_id
       and provider = 'google_business'
  ) then
    raise exception 'connection_not_found';
  end if;

  if p_destinations is null or jsonb_typeof(p_destinations) <> 'array' or jsonb_array_length(p_destinations) = 0 then
    raise exception 'destination_required';
  end if;

  delete from public.marketing_destinations d
   where d.connection_id = p_connection_id
     and d.tenant_id = p_tenant_id
     and d.provider = 'google_business'
     and not exists (
       select 1
         from jsonb_array_elements(p_destinations) kept
        where kept->>'provider_destination_id' = d.provider_destination_id
          and kept->>'destination_type' = 'google_business_location'
     );

  for elem in
    select value from jsonb_array_elements(p_destinations)
  loop
    v_destination_id := elem->>'provider_destination_id';
    v_name := btrim(elem->>'display_name');
    v_account := elem->>'account_name';

    if coalesce(elem->>'destination_type', '') <> 'google_business_location' then
      raise exception 'invalid_destination_type';
    end if;
    if v_destination_id is null
       or v_destination_id !~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}$' then
      raise exception 'invalid_destination_id';
    end if;
    if v_name is null or length(v_name) = 0 or length(v_name) > 120 then
      raise exception 'invalid_destination_name';
    end if;
    if v_account is null or v_account !~ '^accounts/[0-9]{1,30}$' then
      raise exception 'invalid_account';
    end if;

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
      p_connection_id,
      p_tenant_id,
      'google_business',
      'google_business_location',
      v_destination_id,
      v_name,
      jsonb_build_object('title', v_name, 'account_name', v_account),
      'active'
    )
    on conflict (tenant_id, provider, provider_destination_id) do update
      set connection_id = excluded.connection_id,
          destination_type = excluded.destination_type,
          display_name = excluded.display_name,
          metadata = excluded.metadata,
          status = 'active',
          updated_at = pg_catalog.now();
  end loop;

  update public.marketing_connections
     set status = 'connected',
         connected_at = coalesce(connected_at, pg_catalog.now()),
         last_error = null,
         last_validated_at = pg_catalog.now(),
         updated_at = pg_catalog.now()
   where id = p_connection_id
     and tenant_id = p_tenant_id
     and provider = 'google_business';

  select count(*)
    into v_count
    from public.marketing_destinations
   where connection_id = p_connection_id
     and tenant_id = p_tenant_id
     and provider = 'google_business';

  return jsonb_build_object('connection_id', p_connection_id, 'destinations', v_count);
end;
$$;

create or replace function public.google_business_read_connection_secret(
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
  v_key_version smallint;
begin
  select *
    into v_connection
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'google_business'
   order by updated_at desc, created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select encode(ciphertext, 'base64'), encode(nonce, 'base64'), key_version
    into v_ciphertext, v_nonce, v_key_version
    from private.marketing_connection_secrets
   where connection_id = v_connection.id
     and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'found', true,
    'connection_id', v_connection.id,
    'status', v_connection.status,
    'provider_account_id', v_connection.provider_account_id,
    'display_name', v_connection.display_name,
    'scopes', to_jsonb(v_connection.scopes),
    'token_expires_at', v_connection.token_expires_at,
    'ciphertext', v_ciphertext,
    'nonce', v_nonce,
    'key_version', v_key_version
  );
end;
$$;

create or replace function public.google_business_disconnect(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':google_business', 42)
  );

  delete from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'google_business';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

create or replace function public.google_business_public_job(p_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id,
    'asset_id', j.asset_id,
    'destination_id', j.destination_id,
    'destination_type', d.destination_type,
    'display_name', d.display_name,
    'provider_destination_id', d.provider_destination_id,
    'status', j.status,
    'execution_mode', j.execution_mode,
    'provider_post_id', j.provider_post_id,
    'safe_error', j.safe_error,
    'caption', a.body,
    'booking_url', a.tracking->>'url'
  )
  from public.integration_publish_jobs j
  join public.marketing_destinations d
    on d.id = j.destination_id
   and d.tenant_id = j.tenant_id
   and d.provider = 'google_business'
  join public.integration_assets a
    on a.id = j.asset_id
   and a.tenant_id = j.tenant_id
  where j.id = p_job_id
    and j.provider = 'google_business';
$$;

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
begin
  if p_tenant_id is null or p_created_by is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_caption is null or length(btrim(p_caption)) = 0 then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if length(p_caption) > 1500 then
    return jsonb_build_object('outcome', 'summary_too_long');
  end if;
  if p_booking_url is null
     or p_booking_url !~ '^https://(www\.)?frizeo\.ro/booking/[A-Za-z0-9._~%-]+([?][A-Za-z0-9._~%=&-]*)?$'
     or p_booking_url ~* 'staging|vercel' then
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
           or a.body is distinct from p_caption
           or a.media_object_path is distinct from p_media_object_path
           or a.tracking->>'url' is distinct from p_booking_url
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
    'google_business',
    p_caption,
    p_media_object_path,
    jsonb_build_object('call_to_action', 'BOOK', 'url', p_booking_url),
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

revoke all on function public.google_business_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.google_business_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.google_business_replace_destinations(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.google_business_read_connection_secret(uuid) from public, anon, authenticated;
revoke all on function public.google_business_disconnect(uuid) from public, anon, authenticated;
revoke all on function public.google_business_public_job(uuid) from public, anon, authenticated;
revoke all on function public.google_business_publish_prepare(uuid, uuid, text, text, text, text, uuid[]) from public, anon, authenticated;

grant execute on function public.google_business_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.google_business_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) to service_role;
grant execute on function public.google_business_replace_destinations(uuid, uuid, jsonb) to service_role;
grant execute on function public.google_business_read_connection_secret(uuid) to service_role;
grant execute on function public.google_business_disconnect(uuid) to service_role;
grant execute on function public.google_business_public_job(uuid) to service_role;
grant execute on function public.google_business_publish_prepare(uuid, uuid, text, text, text, text, uuid[]) to service_role;
