-- Owner Traffic Dashboard — Phase 1.
-- Additive only: first-party consented traffic plus canonical conversion source fields.

begin;

create table if not exists public.marketing_traffic_events (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  event_name text not null,
  visitor_id uuid not null,
  session_id uuid not null,
  path text not null,
  page_title text,
  referrer_host text,
  source text not null default 'direct',
  medium text,
  campaign text,
  content text,
  term text,
  properties jsonb not null default '{}'::jsonb,
  consent_granted boolean not null default true,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint marketing_traffic_events_event_id_key unique (event_id),
  constraint marketing_traffic_events_event_name_chk check (
    event_name in (
      'page_view',
      'signup_view',
      'pricing_view',
      'lead',
      'plan_selected',
      'checkout_started'
    )
  ),
  constraint marketing_traffic_events_path_chk check (
    char_length(path) between 1 and 500
  ),
  constraint marketing_traffic_events_page_title_chk check (
    page_title is null or char_length(page_title) <= 240
  ),
  constraint marketing_traffic_events_referrer_host_chk check (
    referrer_host is null or char_length(referrer_host) <= 255
  ),
  constraint marketing_traffic_events_source_chk check (
    char_length(source) between 1 and 120
  ),
  constraint marketing_traffic_events_medium_chk check (
    medium is null or char_length(medium) <= 120
  ),
  constraint marketing_traffic_events_campaign_chk check (
    campaign is null or char_length(campaign) <= 180
  ),
  constraint marketing_traffic_events_content_chk check (
    content is null or char_length(content) <= 180
  ),
  constraint marketing_traffic_events_term_chk check (
    term is null or char_length(term) <= 180
  ),
  constraint marketing_traffic_events_properties_chk check (
    jsonb_typeof(properties) = 'object'
  ),
  constraint marketing_traffic_events_consent_chk check (consent_granted)
);

create index if not exists marketing_traffic_events_occurred_at_idx
  on public.marketing_traffic_events (occurred_at desc);
create index if not exists marketing_traffic_events_event_occurred_idx
  on public.marketing_traffic_events (event_name, occurred_at desc);
create index if not exists marketing_traffic_events_source_occurred_idx
  on public.marketing_traffic_events (source, occurred_at desc);
create index if not exists marketing_traffic_events_session_occurred_idx
  on public.marketing_traffic_events (session_id, occurred_at desc);
create index if not exists marketing_traffic_events_visitor_occurred_idx
  on public.marketing_traffic_events (visitor_id, occurred_at desc);

alter table public.marketing_traffic_events enable row level security;

-- The browser never accesses this table directly. All writes pass through the
-- validated Next.js route, and all reads happen after the Owner server gate.
revoke all on table public.marketing_traffic_events from public, anon, authenticated;
grant select, insert on table public.marketing_traffic_events to service_role;
revoke all on sequence public.marketing_traffic_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.marketing_traffic_events_id_seq to service_role;

alter table public.marketing_conversions
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid,
  add column if not exists source text,
  add column if not exists medium text,
  add column if not exists utm_campaign text,
  add column if not exists landing_path text,
  add column if not exists referrer_host text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marketing_conversions_source_length_chk'
      and conrelid = 'public.marketing_conversions'::regclass
  ) then
    alter table public.marketing_conversions
      add constraint marketing_conversions_source_length_chk
      check (source is null or char_length(source) <= 120);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'marketing_conversions_attribution_lengths_chk'
      and conrelid = 'public.marketing_conversions'::regclass
  ) then
    alter table public.marketing_conversions
      add constraint marketing_conversions_attribution_lengths_chk
      check (
        (medium is null or char_length(medium) <= 120)
        and (utm_campaign is null or char_length(utm_campaign) <= 180)
        and (landing_path is null or char_length(landing_path) <= 500)
        and (referrer_host is null or char_length(referrer_host) <= 255)
      );
  end if;
end
$$;

create index if not exists marketing_conversions_source_occurred_idx
  on public.marketing_conversions (source, occurred_at desc)
  where source is not null;
create index if not exists marketing_conversions_visitor_occurred_idx
  on public.marketing_conversions (visitor_id, occurred_at desc)
  where visitor_id is not null;
create index if not exists marketing_conversions_session_occurred_idx
  on public.marketing_conversions (session_id, occurred_at desc)
  where session_id is not null;

create or replace function public.get_owner_analytics_dashboard(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with
  traffic as (
    select *
    from public.marketing_traffic_events
    where occurred_at >= p_from and occurred_at < p_to
  ),
  conversions as (
    select *
    from public.marketing_conversions
    where occurred_at >= p_from and occurred_at < p_to
  ),
  email_events as (
    select *
    from public.marketing_email_events
    where event_timestamp >= p_from and event_timestamp < p_to
  ),
  traffic_sources as (
    select
      coalesce(nullif(source, ''), 'direct') as source,
      count(distinct session_id)::bigint as sessions,
      count(distinct visitor_id)::bigint as visitors,
      count(*) filter (where event_name = 'lead')::bigint as leads
    from traffic
    group by 1
  ),
  conversion_sources as (
    select
      coalesce(
        nullif(source, ''),
        case
          when campaign_id is not null
            or automation_id is not null
            or attribution_link_id is not null
            then 'frizeo_email'
          else 'unknown'
        end
      ) as source,
      count(*) filter (where conversion_type = 'signup')::bigint as signups,
      count(*) filter (where conversion_type = 'trial_started')::bigint as trials,
      count(*) filter (where conversion_type = 'subscription_started')::bigint as paid
    from conversions
    group by 1
  ),
  source_keys as (
    select source from traffic_sources
    union
    select source from conversion_sources
  ),
  days as (
    select generate_series(
      (p_from at time zone 'Europe/Bucharest')::date,
      ((p_to - interval '1 microsecond') at time zone 'Europe/Bucharest')::date,
      interval '1 day'
    )::date as day
  ),
  daily_traffic as (
    select
      (occurred_at at time zone 'Europe/Bucharest')::date as day,
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct visitor_id)::bigint as visitors,
      count(distinct session_id)::bigint as sessions,
      count(*) filter (where event_name = 'lead')::bigint as leads
    from traffic
    group by 1
  ),
  daily_conversions as (
    select
      (occurred_at at time zone 'Europe/Bucharest')::date as day,
      count(*) filter (where conversion_type = 'signup')::bigint as signups,
      count(*) filter (where conversion_type = 'trial_started')::bigint as trials,
      count(*) filter (where conversion_type = 'subscription_started')::bigint as paid
    from conversions
    group by 1
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'traffic', jsonb_build_object(
      'page_views', (select count(*) from traffic where event_name = 'page_view'),
      'visitors', (select count(distinct visitor_id) from traffic),
      'sessions', (select count(distinct session_id) from traffic),
      'leads', (select count(*) from traffic where event_name = 'lead'),
      'signup_views', (select count(*) from traffic where event_name = 'signup_view'),
      'pricing_views', (select count(*) from traffic where event_name = 'pricing_view')
    ),
    'conversions', jsonb_build_object(
      'signups', (select count(*) from conversions where conversion_type = 'signup'),
      'trials', (select count(*) from conversions where conversion_type = 'trial_started'),
      'paid', (select count(*) from conversions where conversion_type = 'subscription_started'),
      'mrr', (select coalesce(sum(mrr_amount), 0) from conversions where conversion_type = 'subscription_started'),
      'currency', (select coalesce(max(currency), 'RON') from conversions where conversion_type = 'subscription_started')
    ),
    'email', jsonb_build_object(
      'sent', (select count(distinct provider_event_id) from email_events where type = 'sent'),
      'delivered', (select count(distinct provider_event_id) from email_events where type = 'delivered'),
      'opened', (select count(distinct provider_event_id) from email_events where type = 'opened'),
      'clicked', (select count(distinct provider_event_id) from email_events where type = 'clicked'),
      'bounced', (select count(distinct provider_event_id) from email_events where type = 'bounced'),
      'unsubscribed', (select count(distinct provider_event_id) from email_events where type = 'unsubscribed')
    ),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source', source_keys.source,
          'sessions', coalesce(traffic_sources.sessions, 0),
          'visitors', coalesce(traffic_sources.visitors, 0),
          'leads', coalesce(traffic_sources.leads, 0),
          'signups', coalesce(conversion_sources.signups, 0),
          'trials', coalesce(conversion_sources.trials, 0),
          'paid', coalesce(conversion_sources.paid, 0)
        )
        order by coalesce(traffic_sources.sessions, 0) desc,
          coalesce(conversion_sources.trials, 0) desc,
          source_keys.source
      )
      from source_keys
      left join traffic_sources using (source)
      left join conversion_sources using (source)
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', to_char(days.day, 'YYYY-MM-DD'),
          'page_views', coalesce(daily_traffic.page_views, 0),
          'visitors', coalesce(daily_traffic.visitors, 0),
          'sessions', coalesce(daily_traffic.sessions, 0),
          'leads', coalesce(daily_traffic.leads, 0),
          'signups', coalesce(daily_conversions.signups, 0),
          'trials', coalesce(daily_conversions.trials, 0),
          'paid', coalesce(daily_conversions.paid, 0)
        )
        order by days.day
      )
      from days
      left join daily_traffic using (day)
      left join daily_conversions using (day)
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', recent.kind,
          'event_name', recent.event_name,
          'source', recent.source,
          'path', recent.path,
          'occurred_at', recent.occurred_at
        )
        order by recent.occurred_at desc
      )
      from (
        select
          'traffic'::text as kind,
          event_name,
          coalesce(nullif(source, ''), 'direct') as source,
          path,
          occurred_at
        from traffic
        union all
        select
          'conversion'::text as kind,
          conversion_type as event_name,
          coalesce(
            nullif(source, ''),
            case
              when campaign_id is not null
                or automation_id is not null
                or attribution_link_id is not null
                then 'frizeo_email'
              else 'unknown'
            end
          ) as source,
          landing_path as path,
          occurred_at
        from conversions
        order by occurred_at desc
        limit 30
      ) recent
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_owner_analytics_dashboard(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_owner_analytics_dashboard(timestamptz, timestamptz)
  to service_role;

comment on table public.marketing_traffic_events is
  'Consented first-party Frizeo acquisition events. No email, phone, IP address, or raw user agent is stored.';
comment on function public.get_owner_analytics_dashboard(timestamptz, timestamptz) is
  'Server-only aggregate for the Owner Traffic & Conversions dashboard.';

commit;
