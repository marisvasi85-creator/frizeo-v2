-- Meta OAuth gateway. Additive. Private tables stay unexposed.
-- These functions run as the invoker and are executable only by service_role,
-- which already has grants on private.integration_oauth_states and
-- private.marketing_connection_secrets.

create or replace function public.integration_oauth_state_insert(
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
    'meta',
    p_state_hash,
    decode(p_pkce_ciphertext, 'base64'),
    decode(p_pkce_nonce, 'base64'),
    p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

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
  if p_provider is distinct from 'meta' then
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

  if r.provider is distinct from 'meta' then
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

create or replace function public.meta_upsert_connection(
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
  if p_provider_account_id is null or length(btrim(p_provider_account_id)) = 0 then
    raise exception 'provider_account_required';
  end if;
  if p_ciphertext is null or p_nonce is null then
    raise exception 'secret_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':meta', 42)
  );

  select id
    into v_id
    from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'meta'
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
      'meta',
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
       and provider = 'meta';
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

create or replace function public.meta_replace_destinations(
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
  v_type text;
  v_destination_id text;
  v_name text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':meta', 42)
  );

  if not exists (
    select 1
      from public.marketing_connections
     where id = p_connection_id
       and tenant_id = p_tenant_id
       and provider = 'meta'
  ) then
    raise exception 'connection_not_found';
  end if;

  if p_destinations is null or jsonb_typeof(p_destinations) <> 'array' or jsonb_array_length(p_destinations) = 0 then
    raise exception 'destination_required';
  end if;

  delete from public.marketing_destinations d
   where d.connection_id = p_connection_id
     and d.tenant_id = p_tenant_id
     and not exists (
       select 1
         from jsonb_array_elements(p_destinations) kept
        where kept->>'provider_destination_id' = d.provider_destination_id
          and kept->>'destination_type' = d.destination_type
     );

  for elem in
    select value from jsonb_array_elements(p_destinations)
  loop
    v_type := elem->>'destination_type';
    v_destination_id := elem->>'provider_destination_id';
    v_name := elem->>'display_name';

    if v_type not in ('facebook_page', 'instagram_business') then
      raise exception 'invalid_destination_type';
    end if;
    if v_destination_id is null or v_destination_id !~ '^[0-9]+$' then
      raise exception 'invalid_destination_id';
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
      'meta',
      v_type,
      v_destination_id,
      v_name,
      coalesce(elem->'metadata', '{}'::jsonb),
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
     and provider = 'meta';

  select count(*)
    into v_count
    from public.marketing_destinations
   where connection_id = p_connection_id
     and tenant_id = p_tenant_id;

  return jsonb_build_object('connection_id', p_connection_id, 'destinations', v_count);
end;
$$;

create or replace function public.meta_read_connection_secret(
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
     and provider = 'meta'
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

create or replace function public.meta_disconnect(
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
    pg_catalog.hashtextextended(p_tenant_id::text || ':meta', 42)
  );

  delete from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'meta';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

revoke all on function public.integration_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.integration_oauth_state_consume(text, text) from public, anon, authenticated;
revoke all on function public.meta_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.meta_replace_destinations(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.meta_read_connection_secret(uuid) from public, anon, authenticated;
revoke all on function public.meta_disconnect(uuid) from public, anon, authenticated;

grant execute on function public.integration_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.integration_oauth_state_consume(text, text) to service_role;
grant execute on function public.meta_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) to service_role;
grant execute on function public.meta_replace_destinations(uuid, uuid, jsonb) to service_role;
grant execute on function public.meta_read_connection_secret(uuid) to service_role;
grant execute on function public.meta_disconnect(uuid) to service_role;
