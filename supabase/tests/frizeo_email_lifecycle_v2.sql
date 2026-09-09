-- Lifecycle v2 snapshot transitions. Rolled back.
begin;

do $$
declare
  v_user uuid;
  v_plan uuid;
  v_tenant uuid := '65000000-0000-4000-8000-000000000001';
  v_barber uuid := '65100000-0000-4000-8000-000000000001';
  v_service uuid := '65200000-0000-4000-8000-000000000001';
  v_snap jsonb;
  v_enabled boolean;
  v_state public.tenant_lifecycle_state%ROWTYPE;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;
  select id into v_plan from public.plans where slug = 'pro' limit 1;
  if v_plan is null then raise exception 'test_plan_missing'; end if;

  select enabled into v_enabled from public.marketing_lifecycle_settings where id = 1;
  if v_enabled is distinct from false then
    raise exception 'lifecycle_v2_must_default_off';
  end if;

  insert into public.tenants (id, name, slug)
  values (v_tenant, 'Lifecycle V2', 'lifecycle-v2-test');

  insert into public.barbers (id, user_id, display_name, tenant_id, slug, active)
  values (v_barber, v_user, 'Lifecycle Barber', v_tenant, 'lifecycle-v2-barber', true);

  insert into public.barber_services (
    id, barber_id, tenant_id, name, display_name, duration, active
  ) values (v_service, v_barber, v_tenant, 'Tuns', 'Tuns', 30, true);

  insert into public.barber_weekly_schedule (
    barber_id, tenant_id, day_of_week, is_working, work_start, work_end
  ) values (v_barber, v_tenant, 1, true, '09:00', '18:00');

  v_snap := public.compute_tenant_lifecycle_snapshot(v_tenant);
  if v_snap ->> 'stage' is distinct from 'setup_complete_zero_bookings' then
    raise exception 'expected_zero_bookings_stage: %', v_snap;
  end if;
  if v_snap ->> 'next_best_action' is distinct from 'add_first_manual_booking' then
    raise exception 'expected_add_first_booking_nba: %', v_snap;
  end if;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    status, client_name, client_phone, created_via
  ) values (
    v_barber, v_tenant, v_service, current_date, '10:00', '10:30',
    'confirmed', 'Client Manual', '0700000000', 'dashboard'
  );

  v_snap := public.compute_tenant_lifecycle_snapshot(v_tenant);
  if v_snap ->> 'stage' is distinct from 'manual_booking_only' then
    raise exception 'expected_manual_only: %', v_snap;
  end if;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    status, client_name, client_phone, created_via, expires_at
  ) values (
    v_barber, v_tenant, v_service, current_date, '11:00', '11:30',
    'confirmed', 'Client Online', '0700000001', 'public', now() - interval '1 minute'
  );

  v_snap := public.compute_tenant_lifecycle_snapshot(v_tenant);
  if v_snap ->> 'stage' not in ('first_online_booking', 'building_habit') then
    raise exception 'expected_online_stage: %', v_snap;
  end if;

  v_state := public.refresh_tenant_lifecycle_state(v_tenant);
  if v_state.enrolled_at is null or v_state.stage is null then
    raise exception 'lifecycle_state_not_persisted';
  end if;
end;
$$;

rollback;
