-- Owner Traffic Dashboard Phase 1 smoke tests. All fixtures are rolled back.
begin;

do $$
declare
  v_visitor uuid := '10000000-0000-4000-8000-000000000001';
  v_session uuid := '20000000-0000-4000-8000-000000000001';
  v_payload jsonb;
begin
  if has_table_privilege('anon', 'public.marketing_traffic_events', 'select')
    or has_table_privilege('authenticated', 'public.marketing_traffic_events', 'select')
    or has_table_privilege('anon', 'public.marketing_traffic_events', 'insert')
    or has_table_privilege('authenticated', 'public.marketing_traffic_events', 'insert') then
    raise exception 'owner_analytics_public_privilege_leak';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.marketing_traffic_events',
    'select,insert'
  ) then
    raise exception 'owner_analytics_service_role_privileges_missing';
  end if;

  insert into public.marketing_traffic_events (
    event_id, event_name, visitor_id, session_id, path, source, medium,
    consent_granted, occurred_at
  ) values
    (
      '30000000-0000-4000-8000-000000000001', 'page_view',
      v_visitor, v_session, '/', 'meta', 'paid_social', true,
      '2099-01-02 10:00:00+00'
    ),
    (
      '30000000-0000-4000-8000-000000000002', 'page_view',
      v_visitor, v_session, '/pricing', 'meta', 'paid_social', true,
      '2099-01-02 10:01:00+00'
    ),
    (
      '30000000-0000-4000-8000-000000000003', 'lead',
      v_visitor, v_session, '/signup', 'meta', 'paid_social', true,
      '2099-01-02 10:02:00+00'
    );

  begin
    insert into public.marketing_traffic_events (
      event_id, event_name, visitor_id, session_id, path
    ) values (
      '30000000-0000-4000-8000-000000000001', 'page_view',
      v_visitor, v_session, '/duplicate'
    );
    raise exception 'owner_analytics_event_idempotency_failed';
  exception
    when unique_violation then null;
  end;

  insert into public.marketing_conversions (
    conversion_type, attribution_role, visitor_id, session_id, source,
    medium, landing_path, occurred_at, idempotency_key
  ) values (
    'signup', 'acquisition', v_visitor, v_session, 'meta', 'paid_social',
    '/signup', '2099-01-02 10:03:00+00', 'owner_analytics_phase1_signup'
  );

  select public.get_owner_analytics_dashboard(
    '2099-01-02 00:00:00+00',
    '2099-01-03 00:00:00+00'
  ) into v_payload;

  if (v_payload #>> '{traffic,page_views}')::integer <> 2
    or (v_payload #>> '{traffic,visitors}')::integer <> 1
    or (v_payload #>> '{traffic,sessions}')::integer <> 1
    or (v_payload #>> '{traffic,leads}')::integer <> 1 then
    raise exception 'owner_analytics_traffic_aggregate_failed: %', v_payload;
  end if;

  if (v_payload #>> '{conversions,signups}')::integer <> 1 then
    raise exception 'owner_analytics_conversion_aggregate_failed: %', v_payload;
  end if;

  if jsonb_array_length(v_payload -> 'sources') <> 1
    or v_payload #>> '{sources,0,source}' <> 'meta' then
    raise exception 'owner_analytics_source_dedupe_failed: %', v_payload;
  end if;

  raise notice 'owner_traffic_dashboard_phase1_ok';
end $$;

rollback;

select 'owner_traffic_dashboard_phase1_db_tests_passed' as result;
