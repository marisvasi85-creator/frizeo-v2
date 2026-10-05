-- Integrity hardening for the Frizeo 2.0 foundation.
-- Additive. Does not alter bookings, Frizeo Email, billing, or Google Calendar.

-- A secret row cannot name a different tenant than its connection,
-- including when the connection tenant is updated later.
create unique index if not exists marketing_connections_id_tenant_key
  on public.marketing_connections (id, tenant_id);

alter table private.marketing_connection_secrets
  drop constraint if exists connection_secrets_same_tenant_fkey;

alter table private.marketing_connection_secrets
  add constraint connection_secrets_same_tenant_fkey
  foreign key (connection_id, tenant_id)
  references public.marketing_connections (id, tenant_id);

create or replace function private.enforce_connection_secret_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id
    into v_tenant
    from public.marketing_connections
   where id = new.connection_id;

  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'connection secret tenant mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists connection_secrets_tenant on private.marketing_connection_secrets;
create trigger connection_secrets_tenant
  before insert or update on private.marketing_connection_secrets
  for each row execute function private.enforce_connection_secret_tenant();

-- A campaign barber, when set, must belong to the campaign tenant.
create or replace function public.enforce_integration_campaign_barber_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if new.barber_id is null then
    return new;
  end if;

  select tenant_id
    into v_tenant
    from public.barbers
   where id = new.barber_id;

  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'campaign barber tenant mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists integration_campaigns_barber on public.integration_campaigns;
create trigger integration_campaigns_barber
  before insert or update on public.integration_campaigns
  for each row execute function public.enforce_integration_campaign_barber_tenant();

-- The publish job asset must belong to the job campaign.
create or replace function public.enforce_marketing_publish_job_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_campaign_tenant uuid;
  v_asset_tenant uuid;
  v_asset_campaign uuid;
  v_destination_tenant uuid;
  v_destination_provider text;
begin
  select tenant_id
    into v_campaign_tenant
    from public.integration_campaigns
   where id = new.campaign_id;

  select tenant_id, campaign_id
    into v_asset_tenant, v_asset_campaign
    from public.integration_assets
   where id = new.asset_id;

  select tenant_id, provider
    into v_destination_tenant, v_destination_provider
    from public.marketing_destinations
   where id = new.destination_id;

  if v_campaign_tenant is null
     or v_campaign_tenant <> new.tenant_id
     or v_asset_tenant is null
     or v_asset_tenant <> new.tenant_id
     or v_destination_tenant is null
     or v_destination_tenant <> new.tenant_id
     or v_destination_provider <> new.provider then
    raise exception 'publish job tenant mismatch';
  end if;

  if v_asset_campaign is null or v_asset_campaign <> new.campaign_id then
    raise exception 'publish job asset campaign mismatch';
  end if;

  return new;
end;
$$;

-- Secret keys are rejected at any object depth, including arrays.
create or replace function public.json_contains_secret_key(
  p_value jsonb,
  p_forbidden text[]
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_queue jsonb := '[]'::jsonb;
  v_current jsonb;
  v_key text;
  v_item jsonb;
begin
  if p_value is null or p_forbidden is null then
    return false;
  end if;

  v_queue := jsonb_build_array(p_value);
  while jsonb_array_length(v_queue) > 0 loop
    v_current := v_queue -> 0;
    v_queue := v_queue - 0;

    if jsonb_typeof(v_current) = 'object' then
      for v_key in select jsonb_object_keys(v_current) loop
        if v_key = any (p_forbidden) then
          return true;
        end if;
        if jsonb_typeof(v_current -> v_key) in ('object', 'array') then
          v_queue := v_queue || jsonb_build_array(v_current -> v_key);
        end if;
      end loop;
    elsif jsonb_typeof(v_current) = 'array' then
      for v_item in select value from jsonb_array_elements(v_current) loop
        if jsonb_typeof(v_item) in ('object', 'array') then
          v_queue := v_queue || jsonb_build_array(v_item);
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.reject_secret_json_keys()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  forbidden text[] := array[
    'access_token',
    'refresh_token',
    'client_secret',
    'token',
    'authorization',
    'code_verifier',
    'ciphertext',
    'pkce_verifier'
  ];
begin
  if tg_table_name = 'marketing_destinations' then
    if public.json_contains_secret_key(new.metadata, forbidden) then
      raise exception 'metadata contains a secret key';
    end if;
  elsif tg_table_name = 'integration_assets' then
    if public.json_contains_secret_key(new.tracking, forbidden)
       or public.json_contains_secret_key(new.utm, forbidden) then
      raise exception 'tracking contains a secret key';
    end if;
  end if;
  return new;
end;
$$;

-- Expired grant remainder dies with the grant. A debit consumes the
-- soonest-expiring lot that was still valid when the debit was written,
-- so it does not reduce a later grant.
create or replace function private.credit_balance(
  p_tenant_id uuid,
  p_at timestamptz
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_lots jsonb := '[]'::jsonb;
  v_need integer;
  v_index integer;
  v_best integer;
  v_lot jsonb;
  v_remaining integer;
  v_expires timestamptz;
  v_created timestamptz;
  v_best_expires timestamptz;
  v_best_created timestamptz;
  v_take integer;
  v_total integer := 0;
begin
  for r in
    select entry_type, amount, expires_at, created_at
      from public.credit_ledger
     where tenant_id = p_tenant_id
     order by created_at, id
  loop
    if r.amount > 0
       and r.entry_type in ('included_grant', 'purchased_grant', 'reversal', 'adjustment') then
      v_lots := v_lots || jsonb_build_array(
        jsonb_build_object(
          'remaining', r.amount,
          'expires_at', r.expires_at,
          'created_at', r.created_at
        )
      );
    elsif r.amount < 0 and r.entry_type in ('debit', 'adjustment') then
      v_need := -r.amount;
      while v_need > 0 loop
        v_best := null;
        v_best_expires := null;
        v_best_created := null;

        for v_index in 0 .. jsonb_array_length(v_lots) - 1 loop
          v_lot := v_lots -> v_index;
          v_remaining := (v_lot ->> 'remaining')::integer;
          if v_remaining <= 0 then
            continue;
          end if;

          v_expires := (v_lot ->> 'expires_at')::timestamptz;
          v_created := (v_lot ->> 'created_at')::timestamptz;
          if v_expires is not null and v_expires <= r.created_at then
            continue;
          end if;

          if v_best is null
             or (
               v_expires is not null
               and (
                 v_best_expires is null
                 or v_expires < v_best_expires
                 or (v_expires = v_best_expires and v_created < v_best_created)
               )
             )
             or (
               v_expires is null
               and v_best_expires is null
               and v_created < v_best_created
             ) then
            v_best := v_index;
            v_best_expires := v_expires;
            v_best_created := v_created;
          end if;
        end loop;

        if v_best is null then
          exit;
        end if;

        v_take := least(v_need, (v_lots -> v_best ->> 'remaining')::integer);
        v_lots := jsonb_set(
          v_lots,
          array[v_best::text, 'remaining'],
          to_jsonb((v_lots -> v_best ->> 'remaining')::integer - v_take)
        );
        v_need := v_need - v_take;
      end loop;
    end if;
  end loop;

  for v_index in 0 .. jsonb_array_length(v_lots) - 1 loop
    v_lot := v_lots -> v_index;
    v_expires := (v_lot ->> 'expires_at')::timestamptz;
    if v_expires is null or v_expires > p_at then
      v_total := v_total + (v_lot ->> 'remaining')::integer;
    end if;
  end loop;

  return v_total;
end;
$$;

create or replace function private.apply_credit_debit(
  p_tenant_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_balance integer;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'debit_amount_must_be_positive';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 42));

  select id
    into v_existing
    from public.credit_ledger
   where tenant_id = p_tenant_id
     and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  v_balance := private.credit_balance(p_tenant_id, now());
  if v_balance < p_amount then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (
    tenant_id,
    entry_type,
    amount,
    idempotency_key,
    note,
    created_by
  ) values (
    p_tenant_id,
    'debit',
    -p_amount,
    p_idempotency_key,
    p_note,
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.enforce_connection_secret_tenant() from public, anon, authenticated;
revoke all on function public.enforce_integration_campaign_barber_tenant() from public, anon, authenticated;
revoke all on function public.enforce_marketing_publish_job_tenant() from public, anon, authenticated;
revoke all on function public.json_contains_secret_key(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.reject_secret_json_keys() from public, anon, authenticated;
revoke all on function private.credit_balance(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.apply_credit_debit(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function private.credit_balance(uuid, timestamptz) to service_role;
grant execute on function private.apply_credit_debit(uuid, integer, text, text, uuid) to service_role;
