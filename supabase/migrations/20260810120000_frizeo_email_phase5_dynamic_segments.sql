-- Frizeo Email Phase 5: dynamic, server-evaluated marketing segments.
-- Scope is intentionally limited to marketing_* objects. Existing Frizeo data is read-only.

create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  segment_key text,
  name text not null,
  description text not null default '',
  category text not null default 'custom',
  definition jsonb not null,
  is_system_segment boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_segments_name_check
    check (char_length(trim(name)) between 1 and 160),
  constraint marketing_segments_description_check
    check (char_length(description) <= 1000),
  constraint marketing_segments_category_check
    check (char_length(trim(category)) between 1 and 80),
  constraint marketing_segments_system_key_check
    check (not is_system_segment or segment_key is not null)
);

create unique index if not exists marketing_segments_key_uidx
  on public.marketing_segments (segment_key)
  where segment_key is not null;
create unique index if not exists marketing_segments_custom_name_uidx
  on public.marketing_segments (lower(name))
  where is_system_segment = false and deleted_at is null;
create index if not exists marketing_segments_active_type_idx
  on public.marketing_segments (is_system_segment desc, category, name)
  where deleted_at is null;
create index if not exists marketing_segments_created_by_idx
  on public.marketing_segments (created_by)
  where created_by is not null;
create index if not exists marketing_segments_deleted_by_idx
  on public.marketing_segments (deleted_by)
  where deleted_by is not null;

alter table public.marketing_segments enable row level security;

drop policy if exists "marketing_segments_platform_admin_all"
  on public.marketing_segments;
create policy "marketing_segments_platform_admin_all"
on public.marketing_segments
for all
to authenticated
using (
  exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = (select auth.uid())
  )
);

revoke all on public.marketing_segments from public, anon;
grant select, insert, update, delete
  on public.marketing_segments to authenticated, service_role;

create or replace function public.marketing_validate_segment_definition(
  p_definition jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_condition jsonb;
  v_field text;
  v_operator text;
  v_value jsonb;
  v_item jsonb;
begin
  if jsonb_typeof(p_definition) <> 'object'
     or coalesce(p_definition->>'logic', '') <> 'AND'
     or coalesce((p_definition->>'version')::integer, 0) <> 1
     or jsonb_typeof(p_definition->'conditions') <> 'array'
     or jsonb_array_length(p_definition->'conditions') not between 1 and 10 then
    return false;
  end if;

  for v_condition in
    select value from jsonb_array_elements(p_definition->'conditions')
  loop
    if jsonb_typeof(v_condition) <> 'object' then
      return false;
    end if;

    v_field := coalesce(v_condition->>'field', '');
    v_operator := coalesce(v_condition->>'operator', '');
    v_value := v_condition->'value';

    if v_field in (
      'source', 'contact_status', 'account_status', 'subscription_plan',
      'subscription_status', 'trial_status', 'bookings_count_bucket',
      'activity_status'
    ) then
      if v_operator not in ('equals', 'not_equals', 'in') then
        return false;
      end if;
      if v_operator = 'in' then
        if jsonb_typeof(v_value) <> 'array'
           or jsonb_array_length(v_value) not between 1 and 20 then
          return false;
        end if;
        for v_item in select value from jsonb_array_elements(v_value)
        loop
          if jsonb_typeof(v_item) <> 'string'
             or char_length(v_item #>> '{}') > 120 then
            return false;
          end if;
        end loop;
      elsif jsonb_typeof(v_value) <> 'string'
            or char_length(v_value #>> '{}') > 120 then
        return false;
      end if;
    elsif v_field in ('trial_end_date', 'created_at', 'last_activity') then
      if v_operator not in ('equals', 'before', 'after')
         or jsonb_typeof(v_value) <> 'string'
         or (v_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
        return false;
      end if;
      begin
        perform (v_value #>> '{}')::date;
      exception when others then
        return false;
      end;
    elsif v_field = 'bookings_count' then
      if v_operator not in ('equals', 'greater_than', 'less_than')
         or jsonb_typeof(v_value) <> 'number' then
        return false;
      end if;
    elsif v_field in ('consent_status', 'is_paid') then
      if v_operator not in ('yes', 'no') then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.protect_marketing_segment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.is_system_segment then
    raise exception 'system_segment_immutable';
  end if;

  if tg_op <> 'DELETE' then
    if not public.marketing_validate_segment_definition(new.definition) then
      raise exception 'invalid_segment_definition';
    end if;
    if new.is_system_segment and new.segment_key is null then
      raise exception 'system_segment_key_required';
    end if;
    new.updated_at := now();
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_marketing_segment_trigger
  on public.marketing_segments;
create trigger protect_marketing_segment_trigger
before insert or update or delete on public.marketing_segments
for each row execute function public.protect_marketing_segment();

create or replace function public.is_marketing_contact_eligible(
  p_contact_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.marketing_contacts contact
    where contact.id = p_contact_id
      and contact.status = 'subscribed'
      and contact.marketing_consent = true
      and contact.consent_at is not null
      and contact.unsubscribed_at is null
      and contact.bounced_at is null
      and contact.complained_at is null
      and contact.suppression_reason is null
      and contact.deleted_at is null
      and char_length(contact.email_normalized) <= 320
      and contact.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and not exists (
        select 1
        from public.marketing_unsubscribe_events unsubscribe_event
        where unsubscribe_event.contact_id = contact.id
      )
  );
$$;

create or replace function public.marketing_contact_facts()
returns table (
  contact_id uuid,
  email text,
  first_name text,
  last_name text,
  source text,
  contact_status text,
  account_status text,
  subscription_plan text,
  subscription_status text,
  is_paid boolean,
  trial_status text,
  trial_end_date date,
  bookings_count integer,
  bookings_count_bucket text,
  created_at timestamptz,
  last_activity timestamptz,
  activity_status text,
  consent_status boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with business_clock as (
    select timezone('Europe/Bucharest', now())::date as today
  ),
  booking_counts as (
    select booking.tenant_id, count(*)::integer as bookings_count
    from public.bookings booking
    where booking.status = 'confirmed'
      and booking.tenant_id is not null
    group by booking.tenant_id
  )
  select
    contact.id as contact_id,
    contact.email,
    contact.first_name,
    contact.last_name,
    contact.source,
    contact.status as contact_status,
    case when contact.user_id is null then 'lead' else 'registered' end,
    coalesce(plan.slug, 'none') as subscription_plan,
    coalesce(subscription.status, 'none') as subscription_status,
    coalesce(
      subscription.status = 'active'
      and subscription.stripe_subscription_id is not null,
      false
    ) as is_paid,
    case
      when subscription.status <> 'trialing'
           or subscription.trial_ends_at is null then 'none'
      when subscription.trial_ends_at::date < clock.today then 'expired'
      when subscription.trial_ends_at::date = clock.today then 'last_day'
      when subscription.trial_ends_at::date = clock.today + 3 then 'ending_3_days'
      when subscription.trial_ends_at::date = clock.today + 7 then 'ending_7_days'
      else 'active'
    end as trial_status,
    subscription.trial_ends_at::date as trial_end_date,
    coalesce(booking_count.bookings_count, 0) as bookings_count,
    case
      when coalesce(booking_count.bookings_count, 0) = 0 then 'none'
      when booking_count.bookings_count <= 5 then '1_5'
      else '6_plus'
    end as bookings_count_bucket,
    contact.created_at,
    coalesce(auth_user.last_sign_in_at, auth_user.created_at) as last_activity,
    case
      when coalesce(auth_user.last_sign_in_at, auth_user.created_at) is null
        then 'unknown'
      when coalesce(auth_user.last_sign_in_at, auth_user.created_at)
        >= now() - interval '7 days' then 'recently_active'
      when coalesce(auth_user.last_sign_in_at, auth_user.created_at)
        < now() - interval '14 days' then 'inactive_14_days'
      else 'between_7_and_14_days'
    end as activity_status,
    contact.marketing_consent as consent_status
  from public.marketing_contacts contact
  cross join business_clock clock
  left join public.subscriptions subscription
    on subscription.tenant_id = contact.tenant_id
  left join public.plans plan on plan.id = subscription.plan_id
  left join booking_counts booking_count
    on booking_count.tenant_id = contact.tenant_id
  left join auth.users auth_user on auth_user.id = contact.user_id
  where public.is_marketing_contact_eligible(contact.id);
$$;

create or replace function public.marketing_segment_condition_matches(
  p_fact jsonb,
  p_condition jsonb
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_field text := p_condition->>'field';
  v_operator text := p_condition->>'operator';
  v_value jsonb := p_condition->'value';
  v_fact_text text;
  v_fact_date date;
  v_target_date date;
  v_fact_number numeric;
  v_target_number numeric;
  v_fact_boolean boolean;
begin
  if v_field in (
    'source', 'contact_status', 'account_status', 'subscription_plan',
    'subscription_status', 'trial_status', 'bookings_count_bucket',
    'activity_status'
  ) then
    v_fact_text := coalesce(p_fact->>v_field, '');
    if v_operator = 'equals' then
      return v_fact_text = (v_value #>> '{}');
    elsif v_operator = 'not_equals' then
      return v_fact_text <> (v_value #>> '{}');
    elsif v_operator = 'in' then
      return exists (
        select 1
        from jsonb_array_elements_text(v_value) item(value)
        where item.value = v_fact_text
      );
    end if;
  elsif v_field in ('trial_end_date', 'created_at', 'last_activity') then
    if nullif(p_fact->>v_field, '') is null then
      return false;
    end if;
    v_fact_date := (p_fact->>v_field)::timestamptz::date;
    if v_field = 'trial_end_date' then
      v_fact_date := (p_fact->>v_field)::date;
    end if;
    v_target_date := (v_value #>> '{}')::date;
    if v_operator = 'equals' then return v_fact_date = v_target_date; end if;
    if v_operator = 'before' then return v_fact_date < v_target_date; end if;
    if v_operator = 'after' then return v_fact_date > v_target_date; end if;
  elsif v_field = 'bookings_count' then
    v_fact_number := coalesce((p_fact->>v_field)::numeric, 0);
    v_target_number := (v_value #>> '{}')::numeric;
    if v_operator = 'equals' then return v_fact_number = v_target_number; end if;
    if v_operator = 'greater_than' then return v_fact_number > v_target_number; end if;
    if v_operator = 'less_than' then return v_fact_number < v_target_number; end if;
  elsif v_field in ('consent_status', 'is_paid') then
    v_fact_boolean := coalesce((p_fact->>v_field)::boolean, false);
    if v_operator = 'yes' then return v_fact_boolean; end if;
    if v_operator = 'no' then return not v_fact_boolean; end if;
  end if;

  return false;
exception when others then
  return false;
end;
$$;

create or replace function public.marketing_segment_definition_matches(
  p_fact jsonb,
  p_definition jsonb
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.marketing_validate_segment_definition(p_definition)
    and not exists (
      select 1
      from jsonb_array_elements(p_definition->'conditions') condition(value)
      where not public.marketing_segment_condition_matches(p_fact, condition.value)
    );
$$;

create or replace function public.marketing_evaluate_segment_definition(
  p_definition jsonb
)
returns table (
  contact_id uuid,
  email text,
  first_name text,
  last_name text,
  source text,
  contact_status text,
  account_status text,
  subscription_plan text,
  subscription_status text,
  is_paid boolean,
  trial_status text,
  trial_end_date date,
  bookings_count integer,
  bookings_count_bucket text,
  created_at timestamptz,
  last_activity timestamptz,
  activity_status text,
  consent_status boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select fact.*
  from public.marketing_contact_facts() fact
  where public.marketing_segment_definition_matches(to_jsonb(fact), p_definition);
$$;

create or replace function public.marketing_list_segments_with_counts()
returns table (
  id uuid,
  segment_key text,
  name text,
  description text,
  category text,
  definition jsonb,
  is_system_segment boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  contacts_count bigint,
  evaluated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with facts as materialized (
    select fact.*, to_jsonb(fact) as fact_json
    from public.marketing_contact_facts() fact
  )
  select
    segment.id,
    segment.segment_key,
    segment.name,
    segment.description,
    segment.category,
    segment.definition,
    segment.is_system_segment,
    segment.created_by,
    segment.created_at,
    segment.updated_at,
    count(fact.contact_id) filter (
      where public.marketing_segment_definition_matches(
        fact.fact_json,
        segment.definition
      )
    ) as contacts_count,
    now() as evaluated_at
  from public.marketing_segments segment
  left join facts fact on true
  where segment.deleted_at is null
  group by segment.id
  order by segment.is_system_segment desc, segment.category, segment.name;
$$;

create or replace function public.marketing_segment_members(
  p_segment_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  contact_id uuid,
  email text,
  first_name text,
  last_name text,
  source text,
  contact_status text,
  account_status text,
  subscription_plan text,
  subscription_status text,
  is_paid boolean,
  trial_status text,
  trial_end_date date,
  bookings_count integer,
  bookings_count_bucket text,
  created_at timestamptz,
  last_activity timestamptz,
  activity_status text,
  consent_status boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_definition jsonb;
begin
  select segment.definition into v_definition
  from public.marketing_segments segment
  where segment.id = p_segment_id and segment.deleted_at is null;

  if v_definition is null then
    raise exception 'segment_not_found';
  end if;

  return query
  with matches as materialized (
    select member.*
    from public.marketing_evaluate_segment_definition(v_definition) member
  )
  select matches.*, count(*) over() as total_count
  from matches
  order by matches.created_at desc, matches.contact_id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.marketing_preview_segment(
  p_definition jsonb,
  p_limit integer default 10
)
returns table (
  contact_id uuid,
  email text,
  first_name text,
  last_name text,
  source text,
  contact_status text,
  account_status text,
  subscription_plan text,
  subscription_status text,
  is_paid boolean,
  trial_status text,
  trial_end_date date,
  bookings_count integer,
  bookings_count_bucket text,
  created_at timestamptz,
  last_activity timestamptz,
  activity_status text,
  consent_status boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.marketing_validate_segment_definition(p_definition) then
    raise exception 'invalid_segment_definition';
  end if;

  return query
  with matches as materialized (
    select member.*
    from public.marketing_evaluate_segment_definition(p_definition) member
  )
  select matches.*, count(*) over() as total_count
  from matches
  order by matches.created_at desc, matches.contact_id
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
end;
$$;

alter table public.marketing_campaigns
  add column if not exists segment_id uuid
    references public.marketing_segments(id) on delete set null,
  add column if not exists segment_key_snapshot text,
  add column if not exists segment_name_snapshot text,
  add column if not exists segment_definition_snapshot jsonb;

create index if not exists marketing_campaigns_segment_id_idx
  on public.marketing_campaigns (segment_id)
  where segment_id is not null;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_audience_kind_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_audience_kind_check
  check (audience_kind in (
    'all_subscribed', 'leads', 'registered_users', 'controlled_test', 'segment'
  ));

create or replace function public.marketing_campaign_audience_contacts(
  p_campaign_id uuid
)
returns table (
  contact_id uuid,
  email text,
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with campaign as (
    select c.audience_kind, c.test_contact_ids, c.segment_id
    from public.marketing_campaigns c
    where c.id = p_campaign_id and c.deleted_at is null
  ),
  selected_segment as (
    select segment.definition
    from public.marketing_segments segment
    join campaign on campaign.segment_id = segment.id
    where segment.deleted_at is null
  )
  select fact.contact_id, fact.email, fact.first_name, fact.last_name
  from campaign
  cross join public.marketing_contact_facts() fact
  left join selected_segment on true
  where campaign.audience_kind = 'all_subscribed'
     or (campaign.audience_kind = 'leads' and fact.account_status = 'lead')
     or (
       campaign.audience_kind = 'registered_users'
       and fact.account_status = 'registered'
     )
     or (
       campaign.audience_kind = 'controlled_test'
       and fact.contact_id = any(campaign.test_contact_ids)
     )
     or (
       campaign.audience_kind = 'segment'
       and selected_segment.definition is not null
       and public.marketing_segment_definition_matches(
         to_jsonb(fact),
         selected_segment.definition
       )
     );
$$;

create or replace function public.snapshot_marketing_campaign_audience(
  p_campaign_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_segment public.marketing_segments%rowtype;
  v_recipient_count integer;
begin
  select campaign.* into v_campaign
  from public.marketing_campaigns campaign
  where campaign.id = p_campaign_id and campaign.deleted_at is null
  for update;

  if not found then raise exception 'campaign_not_found'; end if;
  if v_campaign.status <> 'draft' then raise exception 'campaign_not_draft'; end if;

  if v_campaign.audience_kind = 'controlled_test'
     and cardinality(v_campaign.test_contact_ids) not between 1 and 5 then
    raise exception 'controlled_test_audience_invalid';
  end if;

  if v_campaign.audience_kind = 'segment' then
    select segment.* into v_segment
    from public.marketing_segments segment
    where segment.id = v_campaign.segment_id and segment.deleted_at is null;
    if not found then raise exception 'campaign_segment_invalid'; end if;
  end if;

  delete from public.marketing_campaign_recipients recipient
  where recipient.campaign_id = p_campaign_id;

  insert into public.marketing_campaign_recipients (
    campaign_id, contact_id, email, first_name, last_name, status
  )
  select
    p_campaign_id,
    audience.contact_id,
    audience.email,
    audience.first_name,
    audience.last_name,
    'pending'
  from public.marketing_campaign_audience_contacts(p_campaign_id) audience
  order by audience.contact_id
  on conflict (campaign_id, email_normalized) do nothing;

  get diagnostics v_recipient_count = row_count;

  update public.marketing_campaigns
  set recipient_count = v_recipient_count,
      audience_snapshot_at = now(),
      segment_key_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.segment_key
        else null
      end,
      segment_name_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.name
        else null
      end,
      segment_definition_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.definition
        else null
      end
  where id = p_campaign_id;

  return v_recipient_count;
end;
$$;

create or replace function public.queue_marketing_campaign(
  p_campaign_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_segment public.marketing_segments%rowtype;
  v_recipient_count integer;
begin
  select campaign.* into v_campaign
  from public.marketing_campaigns campaign
  where campaign.id = p_campaign_id and campaign.deleted_at is null
  for update;

  if not found then raise exception 'campaign_not_found'; end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign_already_started';
  end if;
  if char_length(trim(v_campaign.subject)) = 0
     or char_length(trim(v_campaign.body_text)) = 0 then
    raise exception 'campaign_content_incomplete';
  end if;
  if v_campaign.audience_kind = 'controlled_test'
     and cardinality(v_campaign.test_contact_ids) not between 1 and 5 then
    raise exception 'controlled_test_audience_invalid';
  end if;
  if v_campaign.audience_kind = 'segment' then
    select segment.* into v_segment
    from public.marketing_segments segment
    where segment.id = v_campaign.segment_id and segment.deleted_at is null;
    if not found then raise exception 'campaign_segment_invalid'; end if;
  end if;

  delete from public.marketing_campaign_recipients recipient
  where recipient.campaign_id = p_campaign_id;

  insert into public.marketing_campaign_recipients (
    campaign_id,
    contact_id,
    email,
    first_name,
    last_name,
    status,
    queued_at,
    next_attempt_at,
    unsubscribe_token
  )
  select
    p_campaign_id,
    audience.contact_id,
    audience.email,
    audience.first_name,
    audience.last_name,
    'queued',
    now(),
    now(),
    encode(extensions.gen_random_bytes(32), 'hex')
  from public.marketing_campaign_audience_contacts(p_campaign_id) audience
  order by audience.contact_id
  on conflict (campaign_id, email_normalized) do nothing;

  get diagnostics v_recipient_count = row_count;
  if v_recipient_count = 0 then raise exception 'campaign_audience_empty'; end if;

  insert into public.marketing_unsubscribe_tokens (contact_id, token_hash)
  select
    recipient.contact_id,
    encode(extensions.digest(recipient.unsubscribe_token, 'sha256'), 'hex')
  from public.marketing_campaign_recipients recipient
  where recipient.campaign_id = p_campaign_id
    and recipient.contact_id is not null
    and recipient.unsubscribe_token is not null
  on conflict (token_hash) do nothing;

  update public.marketing_campaigns
  set status = 'queued',
      recipient_count = v_recipient_count,
      sent_count = 0,
      failed_count = 0,
      audience_snapshot_at = now(),
      queued_at = now(),
      started_at = null,
      completed_at = null,
      failed_at = null,
      sent_at = null,
      segment_key_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.segment_key
        else null
      end,
      segment_name_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.name
        else null
      end,
      segment_definition_snapshot = case
        when v_campaign.audience_kind = 'segment' then v_segment.definition
        else null
      end
  where id = p_campaign_id;

  return v_recipient_count;
end;
$$;

insert into public.marketing_segments (
  segment_key, name, description, category, definition, is_system_segment
)
values
  (
    'leads', 'Leads',
    'Contacte eligibile pentru marketing fără un cont Frizeo asociat.',
    'account',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"lead"}]}'::jsonb,
    true
  ),
  (
    'registered_users', 'Registered users',
    'Contacte eligibile asociate unui utilizator Frizeo.',
    'account',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"}]}'::jsonb,
    true
  ),
  (
    'trial_active', 'Trial active',
    'Trial activ și fără abonament plătit; include ferestrele de final.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"in","value":["active","ending_7_days","ending_3_days","last_day"]},{"field":"is_paid","operator":"no"}]}'::jsonb,
    true
  ),
  (
    'trial_ending_7_days', 'Trial ending in 7 days',
    'Trial care expiră peste exact 7 zile calendaristice Europe/Bucharest.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"equals","value":"ending_7_days"}]}'::jsonb,
    true
  ),
  (
    'trial_ending_3_days', 'Trial ending in 3 days',
    'Trial care expiră peste exact 3 zile calendaristice Europe/Bucharest.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"equals","value":"ending_3_days"}]}'::jsonb,
    true
  ),
  (
    'trial_last_day', 'Trial last day',
    'Trial care expiră astăzi în fusul Europe/Bucharest.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"equals","value":"last_day"}]}'::jsonb,
    true
  ),
  (
    'trial_expired', 'Trial expired',
    'Trial a cărui dată de final este înainte de ziua curentă.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"equals","value":"expired"}]}'::jsonb,
    true
  ),
  (
    'trial_expired_no_subscription', 'Trial expired without subscription',
    'Trial expirat fără abonament Stripe activ.',
    'trial',
    '{"version":1,"logic":"AND","conditions":[{"field":"trial_status","operator":"equals","value":"expired"},{"field":"is_paid","operator":"no"}]}'::jsonb,
    true
  ),
  (
    'paid_customers', 'Paid customers',
    'Contacte cu abonament activ și identificator Stripe de abonament.',
    'billing',
    '{"version":1,"logic":"AND","conditions":[{"field":"is_paid","operator":"yes"}]}'::jsonb,
    true
  ),
  (
    'no_bookings_yet', 'No bookings yet',
    'Utilizatori înregistrați fără nicio programare confirmată.',
    'engagement',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"},{"field":"bookings_count","operator":"equals","value":0}]}'::jsonb,
    true
  ),
  (
    'has_bookings', 'Has bookings',
    'Utilizatori înregistrați cu cel puțin o programare confirmată.',
    'engagement',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"},{"field":"bookings_count","operator":"greater_than","value":0}]}'::jsonb,
    true
  ),
  (
    'inactive_users', 'Inactive users',
    'Utilizatori fără autentificare relevantă în ultimele 14 zile.',
    'engagement',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"},{"field":"activity_status","operator":"equals","value":"inactive_14_days"}]}'::jsonb,
    true
  ),
  (
    'recently_active', 'Recently active users',
    'Utilizatori cu autentificare relevantă în ultimele 7 zile.',
    'engagement',
    '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"},{"field":"activity_status","operator":"equals","value":"recently_active"}]}'::jsonb,
    true
  )
on conflict (segment_key) where segment_key is not null do nothing;

revoke execute on function public.marketing_validate_segment_definition(jsonb)
  from public, anon, authenticated;
revoke execute on function public.protect_marketing_segment()
  from public, anon, authenticated;
revoke execute on function public.is_marketing_contact_eligible(uuid)
  from public, anon, authenticated;
revoke execute on function public.marketing_contact_facts()
  from public, anon, authenticated;
revoke execute on function public.marketing_segment_condition_matches(jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.marketing_segment_definition_matches(jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.marketing_evaluate_segment_definition(jsonb)
  from public, anon, authenticated;
revoke execute on function public.marketing_list_segments_with_counts()
  from public, anon, authenticated;
revoke execute on function public.marketing_segment_members(uuid, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.marketing_preview_segment(jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.marketing_campaign_audience_contacts(uuid)
  from public, anon, authenticated;
revoke execute on function public.snapshot_marketing_campaign_audience(uuid)
  from public, anon, authenticated;
revoke execute on function public.queue_marketing_campaign(uuid)
  from public, anon, authenticated;

grant execute on function public.marketing_validate_segment_definition(jsonb)
  to service_role;
grant execute on function public.is_marketing_contact_eligible(uuid)
  to service_role;
grant execute on function public.marketing_contact_facts()
  to service_role;
grant execute on function public.marketing_segment_condition_matches(jsonb, jsonb)
  to service_role;
grant execute on function public.marketing_segment_definition_matches(jsonb, jsonb)
  to service_role;
grant execute on function public.marketing_evaluate_segment_definition(jsonb)
  to service_role;
grant execute on function public.marketing_list_segments_with_counts()
  to service_role;
grant execute on function public.marketing_segment_members(uuid, integer, integer)
  to service_role;
grant execute on function public.marketing_preview_segment(jsonb, integer)
  to service_role;
grant execute on function public.marketing_campaign_audience_contacts(uuid)
  to service_role;
grant execute on function public.snapshot_marketing_campaign_audience(uuid)
  to service_role;
grant execute on function public.queue_marketing_campaign(uuid)
  to service_role;

comment on table public.marketing_segments is
  'Dynamic Frizeo Email segment definitions. Definitions are structured JSONB, never raw SQL.';
comment on function public.marketing_contact_facts() is
  'Eligible marketing contacts enriched read-only with Frizeo subscription, booking, and last-login facts.';
comment on function public.marketing_campaign_audience_contacts(uuid) is
  'Re-evaluates the current dynamic audience; campaign recipients remain the immutable send snapshot.';
