-- TikTok Login Kit on staging. Meta and Google Business functions stay as they are.
-- Publishing stays unimplemented. This file does not enable marketing.publish.tiktok.

create or replace function public.tiktok_oauth_state_insert(
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
  if p_expires_at is null or p_expires_at <= pg_catalog.now() then
    raise exception 'oauth_state_expired';
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
    'tiktok',
    p_state_hash,
    decode(p_pkce_ciphertext, 'base64'),
    decode(p_pkce_nonce, 'base64'),
    p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.tiktok_oauth_state_consume(
  p_state_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r private.integration_oauth_states%rowtype;
begin
  if p_state_hash is null or length(btrim(p_state_hash)) = 0 then
    return jsonb_build_object('outcome', 'missing');
  end if;

  select *
    into r
    from private.integration_oauth_states
   where state_hash = p_state_hash
   for update;

  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;

  if r.provider is distinct from 'tiktok' then
    return jsonb_build_object('outcome', 'provider_mismatch');
  end if;

  if r.consumed_at is not null then
    return jsonb_build_object('outcome', 'consumed');
  end if;

  if r.expires_at <= pg_catalog.now() then
    update private.integration_oauth_states
       set consumed_at = pg_catalog.now()
     where id = r.id;
    return jsonb_build_object('outcome', 'expired');
  end if;

  update private.integration_oauth_states
     set consumed_at = pg_catalog.now()
   where id = r.id;

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

create or replace function public.tiktok_upsert_connection(
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
  if p_scopes is distinct from array['user.info.basic']::text[] then
    raise exception 'scope_required';
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

create or replace function public.tiktok_disconnect(
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
    pg_catalog.hashtextextended(p_tenant_id::text || ':tiktok', 42)
  );

  delete from public.marketing_connections
   where tenant_id = p_tenant_id
     and provider = 'tiktok';
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

revoke all on function public.tiktok_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.tiktok_oauth_state_consume(text) from public, anon, authenticated;
revoke all on function public.tiktok_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.tiktok_disconnect(uuid) from public, anon, authenticated;

grant execute on function public.tiktok_oauth_state_insert(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.tiktok_oauth_state_consume(text) to service_role;
grant execute on function public.tiktok_upsert_connection(uuid, text, text, text, text[], uuid, timestamptz, text, text, text, smallint) to service_role;
grant execute on function public.tiktok_disconnect(uuid) to service_role;
