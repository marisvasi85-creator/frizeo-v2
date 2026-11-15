-- Optional public booking link for a Google live post.
-- Does not enable any capability and does not call Google.
-- Apply on Production only during the controlled launch.

create or replace function public.google_business_publish_live_prepare(
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
  v_caption text;
  v_media text;
  v_booking text;
  v_destination uuid;
  v_provider text;
  v_type text;
  v_status text;
  v_location text;
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
  if not exists (
    select 1
      from public.tenant_capabilities
     where tenant_id = p_tenant_id
       and capability = 'marketing.publish.google_business'
       and enabled
  ) or not exists (
    select 1
      from public.tenant_capabilities
     where tenant_id = p_tenant_id
       and capability = 'marketing.publish.google_business.live'
       and enabled
  ) then
    return jsonb_build_object('outcome', 'live_off');
  end if;

  v_caption := btrim(replace(coalesce(p_caption, ''), '**', ''));
  if v_caption = '' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if length(v_caption) > 1500 then
    return jsonb_build_object('outcome', 'summary_too_long');
  end if;
  v_media := btrim(coalesce(p_media_object_path, ''));
  if v_media = '' then
    return jsonb_build_object('outcome', 'image_required');
  end if;
  if v_media !~ (
    '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
  ) then
    return jsonb_build_object('outcome', 'invalid_image');
  end if;
  v_booking := btrim(coalesce(p_booking_url, ''));
  if v_booking <> '' and v_booking !~ '^https://(www\.)?frizeo\.ro/booking/[A-Za-z0-9._~%-]+(/[A-Za-z0-9._~%-]+){0,6}(\?[A-Za-z0-9._~%=&-]{1,240})?$' then
    return jsonb_build_object('outcome', 'booking_link');
  end if;
  if p_destination_ids is null or cardinality(p_destination_ids) <> 1 then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  v_destination := p_destination_ids[1];

  select d.provider, d.destination_type, d.status, d.provider_destination_id
    into v_provider, v_type, v_status, v_location
    from public.marketing_destinations d
   where d.id = v_destination
     and d.tenant_id = p_tenant_id;

  if not found
     or v_provider is distinct from 'google_business'
     or v_type is distinct from 'google_business_location'
     or v_status is distinct from 'active' then
    return jsonb_build_object('outcome', 'destination_mismatch');
  end if;
  if v_location is null
     or v_location !~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}$'
     or not exists (
       select 1
         from public.marketing_connections c
        where c.tenant_id = p_tenant_id
          and c.provider = 'google_business'
          and c.status = 'connected'
          and c.provider_account_id = split_part(v_location, '/locations/', 1)
          and 'https://www.googleapis.com/auth/business.manage' = any (c.scopes)
          and not exists (
            select 1
              from unnest(c.scopes) as scope
             where scope ilike '%calendar%'
          )
     ) then
    return jsonb_build_object('outcome', 'location_ineligible');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':google_business_live', 42)
  );

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
           j.execution_mode is distinct from 'live'
           or a.body is distinct from v_caption
           or a.media_object_path is distinct from v_media
           or coalesce(a.tracking->>'url', '') is distinct from v_booking
           or j.destination_id is distinct from v_destination
         )
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

  if exists (
    select 1
      from public.integration_publish_jobs j
     where j.tenant_id = p_tenant_id
       and j.destination_id = v_destination
       and j.execution_mode = 'live'
       and j.status in ('pending', 'publishing', 'unknown')
  ) then
    return jsonb_build_object('outcome', 'destination_busy');
  end if;

  begin
    insert into public.integration_campaigns (
      tenant_id, type, title, status, created_by
    ) values (
      p_tenant_id, 'normal', left(v_caption, 120), 'draft', p_created_by
    )
    returning id into v_campaign;

    insert into public.integration_assets (
      campaign_id, tenant_id, kind, format, channel, body, media_object_path, tracking, utm
    ) values (
      v_campaign, p_tenant_id, 'image', 'jpeg', 'google_business', v_caption, v_media, case when v_booking = '' then '{}'::jsonb else jsonb_build_object('url', v_booking) end, '{}'::jsonb
    )
    returning id into v_asset;

    insert into public.integration_publish_jobs (
      campaign_id, asset_id, tenant_id, provider, destination_id, status,
      idempotency_key, execution_mode, attempts
    ) values (
      v_campaign, v_asset, p_tenant_id, 'google_business', v_destination,
      'pending', p_idempotency_key, 'live', 0
    );
  exception
    when unique_violation then
      return jsonb_build_object('outcome', 'destination_busy');
  end;

  select coalesce(jsonb_agg(public.google_business_public_job(j.id) order by j.created_at), '[]'::jsonb)
    into v_jobs
    from public.integration_publish_jobs j
   where j.tenant_id = p_tenant_id
     and j.provider = 'google_business'
     and j.asset_id = v_asset;

  return jsonb_build_object('outcome', 'created', 'jobs', v_jobs);
end;
$$;

create or replace function public.google_business_live_settle(
  p_tenant_id uuid,
  p_job_id uuid,
  p_status text,
  p_provider_post_id text,
  p_safe_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
  v_post text := nullif(btrim(coalesce(p_provider_post_id, '')), '');
  v_error text := nullif(btrim(coalesce(p_safe_error, '')), '');
  v_allowed boolean := false;
begin
  if v_post is not null
     and v_post !~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if v_error is not null and v_error !~ '^[a-z0-9_]{1,64}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
     and provider = 'google_business'
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if r.execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'rejected', 'job', public.google_business_public_job(r.id));
  end if;

  if r.status = 'pending' and p_status = 'failed' and v_post is null and v_error in (
    'token_unavailable',
    'token_refresh_failed',
    'summary',
    'image_required',
    'invalid_image',
    'booking_not_allowed',
    'booking_link',
    'location_ineligible'
  ) then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'published' and v_post is not null and v_error is null then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'failed' and v_post is null and v_error in (
    'invalid_parameter',
    'unauthorized',
    'forbidden',
    'not_found',
    'rate_limited',
    'rejected',
    'location_ineligible',
    'invalid_image'
  ) then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'unknown' and v_post is null and v_error = 'ambiguous' then
    v_allowed := true;
  end if;

  if not v_allowed then
    return jsonb_build_object('outcome', 'rejected', 'job', public.google_business_public_job(r.id));
  end if;

  update public.integration_publish_jobs
     set status = p_status,
         provider_post_id = case when p_status = 'published' then v_post else provider_post_id end,
         safe_error = case when p_status = 'published' then null else v_error end,
         published_at = case when p_status = 'published' then pg_catalog.now() else published_at end,
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id
     and provider = 'google_business';

  return jsonb_build_object('outcome', 'updated', 'job', public.google_business_public_job(r.id));
end;
$$;
