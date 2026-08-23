-- Run only after 20260823085235_barber_booking_access.sql.
-- All fixtures and mutations are rolled back.
begin;

do $$
declare
  v_tenant_a uuid := '61000000-0000-4000-8000-000000000001';
  v_tenant_b uuid := '61000000-0000-4000-8000-000000000002';
  v_owner uuid := '62000000-0000-4000-8000-000000000001';
  v_barber_user uuid := '62000000-0000-4000-8000-000000000002';
  v_manager uuid := '62000000-0000-4000-8000-000000000003';
  v_other_owner uuid := '62000000-0000-4000-8000-000000000004';
  v_barber_a uuid := '63000000-0000-4000-8000-000000000001';
  v_barber_b uuid := '63000000-0000-4000-8000-000000000002';
  v_barber_other uuid := '63000000-0000-4000-8000-000000000003';
  v_service_a uuid := '64000000-0000-4000-8000-000000000001';
  v_service_b uuid := '64000000-0000-4000-8000-000000000002';
  v_service_other uuid := '64000000-0000-4000-8000-000000000003';
  v_existing_booking uuid := '65000000-0000-4000-8000-000000000001';
  v_blocked_booking uuid := '65000000-0000-4000-8000-000000000002';
  v_hold uuid := '65000000-0000-4000-8000-000000000003';
  v_blocked_hold uuid := '65000000-0000-4000-8000-000000000004';
  v_transition record;
  v_iteration integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated', 'access-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_barber_user, 'authenticated', 'authenticated', 'access-barber@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_manager, 'authenticated', 'authenticated', 'access-manager@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_other_owner, 'authenticated', 'authenticated', 'access-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.tenants (id, name, slug) values
    (v_tenant_a, 'Access Test A', 'access-test-a'),
    (v_tenant_b, 'Access Test B', 'access-test-b');

  insert into public.tenant_users (tenant_id, user_id, role) values
    (v_tenant_a, v_owner, 'owner'),
    (v_tenant_a, v_barber_user, 'barber'),
    (v_tenant_a, v_manager, 'manager'),
    (v_tenant_b, v_other_owner, 'owner');

  insert into public.barbers (id, user_id, display_name, tenant_id, slug) values
    (v_barber_a, v_owner, 'Access Barber A', v_tenant_a, 'access-barber-a'),
    (v_barber_b, v_barber_user, 'Access Barber B', v_tenant_a, 'access-barber-b'),
    (v_barber_other, v_other_owner, 'Access Barber C', v_tenant_b, 'access-barber-c');

  if (select booking_access_mode from public.barbers where id = v_barber_a) <> 'open' then
    raise exception 'booking_access_default_is_not_open';
  end if;

  insert into public.barber_services (
    id, barber_id, tenant_id, name, display_name, duration, price
  ) values
    (v_service_a, v_barber_a, v_tenant_a, 'Test', 'Test', 30, 50),
    (v_service_b, v_barber_b, v_tenant_a, 'Test', 'Test', 30, 50),
    (v_service_other, v_barber_other, v_tenant_b, 'Test', 'Test', 30, 50);

  if public.normalize_ro_phone('0745 123 456') <> '40745123456'
    or public.normalize_ro_phone('+40 745 123 456') <> '40745123456'
    or public.normalize_ro_phone('0040 745 123 456') <> '40745123456' then
    raise exception 'phone_normalization_failed';
  end if;

  insert into public.bookings (
    id, barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values
    (v_existing_booking, v_barber_a, v_tenant_a, v_service_a, '2099-02-01', '09:00', '09:30', 'Existing Client', '0745 123 456', 'confirmed'),
    (v_blocked_booking, v_barber_a, v_tenant_a, v_service_a, '2099-02-02', '09:00', '09:30', 'Blocked Existing', '0745 333 333', 'confirmed');

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_a, v_tenant_a, v_service_a,
    '2099-02-03', '09:00', '09:30', 'Existing Client Updated', '+40 745 123 456', 'cancelled'
  );

  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values
    (v_tenant_a, v_barber_a, '40745333333', 'Blocked Existing', 'blocked', 'manual_admin'),
    (v_tenant_a, v_barber_b, '40745555555', 'Blocked Open Client', 'blocked', 'manual_admin');

  -- blocked overrides even open for public self-booking.
  begin
    insert into public.bookings (
      barber_id, tenant_id, barber_service_id, date, start_time, end_time,
      client_name, client_phone, status
    ) values (
      v_barber_b, v_tenant_a, v_service_b,
      '2099-02-04', '09:00', '09:30', 'Blocked Open Client', '0745 555 555', 'confirmed'
    );
    raise exception 'blocked_open_client_allowed';
  exception when others then
    if sqlerrm = 'blocked_open_client_allowed' then raise; end if;
    if position('BOOKING_ACCESS_ONLINE_UNAVAILABLE' in sqlerrm) = 0 then raise; end if;
  end;

  -- An unrelated client still uses the exact open flow.
  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_b, v_tenant_a, v_service_b,
    '2099-02-04', '10:00', '10:30', 'Open Client', '0745 666 666', 'confirmed'
  );

  -- open -> restrictive atomically accepts historical unique clients.
  select * into v_transition
  from public.set_barber_booking_access_mode(
    v_barber_a, v_tenant_a, 'approval_required', v_owner
  );

  if v_transition.previous_mode <> 'open'
    or v_transition.mode <> 'approval_required'
    or v_transition.approved_existing_count <> 1 then
    raise exception 'mode_transition_result_invalid';
  end if;

  if not exists (
    select 1 from public.barber_client_access
    where barber_id = v_barber_a
      and phone_normalized = '40745123456'
      and status = 'approved'
      and source = 'existing_client'
  ) then
    raise exception 'existing_client_not_auto_approved';
  end if;

  if (select status from public.barber_client_access
      where barber_id = v_barber_a and phone_normalized = '40745333333') <> 'blocked' then
    raise exception 'blocked_overwritten_on_mode_transition';
  end if;

  select * into v_transition
  from public.set_barber_booking_access_mode(
    v_barber_a, v_tenant_a, 'approval_required', v_owner
  );
  if v_transition.approved_existing_count <> 0 then
    raise exception 'mode_transition_not_idempotent';
  end if;

  -- Restrictive public booking allows approved only.
  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_a, v_barber_a, '40745222222', 'Approval Test', 'pending', 'client_request'
  );

  foreach v_iteration in array array[1, 2, 3]
  loop
    update public.barber_client_access
    set status = case v_iteration
      when 1 then 'pending' when 2 then 'rejected' else 'blocked' end
    where barber_id = v_barber_a and phone_normalized = '40745222222';

    begin
      insert into public.bookings (
        barber_id, tenant_id, barber_service_id, date, start_time, end_time,
        client_name, client_phone, status
      ) values (
        v_barber_a, v_tenant_a, v_service_a,
        ('2099-03-0' || v_iteration::text)::date,
        '10:00', '10:30', 'Approval Test', '0745 222 222', 'confirmed'
      );
      raise exception 'non_approved_public_booking_allowed';
    exception when others then
      if sqlerrm = 'non_approved_public_booking_allowed' then raise; end if;
      if v_iteration = 3 then
        if position('BOOKING_ACCESS_ONLINE_UNAVAILABLE' in sqlerrm) = 0 then raise; end if;
      elsif position('BOOKING_ACCESS_REQUIRED' in sqlerrm) = 0 then
        raise;
      end if;
    end;
  end loop;

  update public.barber_client_access
  set status = 'approved', decision_source = 'manual_admin', decided_at = now()
  where barber_id = v_barber_a and phone_normalized = '40745222222';

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_a, v_tenant_a, v_service_a,
    '2099-03-04', '10:00', '10:30', 'Approval Test', '0040 745 222 222', 'confirmed'
  );

  -- Existing appointments may still be rescheduled by a blocked client.
  perform public.reschedule_booking_safe(
    v_blocked_booking,
    '2099-03-05',
    '11:00',
    'Blocked Existing',
    '0745 333 333',
    null,
    null,
    v_service_a
  );
  if (select status from public.bookings where id = v_blocked_booking) <> 'cancelled' then
    raise exception 'blocked_existing_reschedule_failed';
  end if;

  -- Manual dashboard confirmation approves pending/rejected atomically.
  update public.barber_client_access
  set status = 'pending'
  where barber_id = v_barber_a and phone_normalized = '40745222222';

  insert into public.bookings (
    id, barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    status, expires_at
  ) values (
    v_hold, v_barber_a, v_tenant_a, v_service_a,
    '2099-03-06', '12:00', '12:30', 'pending', now() + interval '10 minutes'
  );

  perform public.confirm_manual_booking_access(
    v_hold, 'Manual Client', '0745 222 222', null, null, v_owner
  );
  if (select status from public.bookings where id = v_hold) <> 'confirmed'
    or (select status from public.barber_client_access
        where barber_id = v_barber_a and phone_normalized = '40745222222') <> 'approved' then
    raise exception 'manual_confirmation_did_not_approve';
  end if;

  -- Manual booking is allowed for blocked, without clearing blocked.
  insert into public.bookings (
    id, barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    status, expires_at
  ) values (
    v_blocked_hold, v_barber_a, v_tenant_a, v_service_a,
    '2099-03-07', '12:00', '12:30', 'pending', now() + interval '10 minutes'
  );

  perform public.confirm_manual_booking_access(
    v_blocked_hold, 'Blocked Existing', '0745 333 333', null, null, v_owner
  );
  if (select status from public.bookings where id = v_blocked_hold) <> 'confirmed'
    or (select status from public.barber_client_access
        where barber_id = v_barber_a and phone_normalized = '40745333333') <> 'blocked' then
    raise exception 'manual_blocked_booking_rule_failed';
  end if;

  -- Assistant/manual direct creation uses the same atomic rule.
  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_a, v_barber_a, '40745777777', 'Assistant Client', 'rejected', 'client_request'
  );

  perform public.create_manual_booking_with_access(
    v_barber_a, v_tenant_a, v_service_a, '2099-03-08', '13:00',
    'Assistant Client', '0745 777 777', null, null, v_owner
  );
  if (select status from public.barber_client_access
      where barber_id = v_barber_a and phone_normalized = '40745777777') <> 'approved' then
    raise exception 'manual_direct_booking_did_not_approve';
  end if;

  -- Approval never leaks between barbers or tenants.
  update public.barbers set booking_access_mode = 'approved_only' where id = v_barber_b;
  begin
    insert into public.bookings (
      barber_id, tenant_id, barber_service_id, date, start_time, end_time,
      client_name, client_phone, status
    ) values (
      v_barber_b, v_tenant_a, v_service_b,
      '2099-03-09', '10:00', '10:30', 'Approval Test', '0745 222 222', 'confirmed'
    );
    raise exception 'approval_leaked_between_barbers';
  exception when others then
    if sqlerrm = 'approval_leaked_between_barbers' then raise; end if;
    if position('BOOKING_ACCESS_REQUIRED' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    insert into public.barber_client_access (
      tenant_id, barber_id, phone_normalized, client_name, status, source
    ) values (
      v_tenant_b, v_barber_a, '40745999999', 'Wrong tenant', 'approved', 'manual_admin'
    );
    raise exception 'cross_tenant_access_row_allowed';
  exception when foreign_key_violation then null;
  end;

  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_b, v_barber_other, '40745444444', 'Tenant B Client', 'pending', 'client_request'
  );

  raise notice 'barber_booking_access_data_tests_ok';
end $$;

-- RLS: owner/manager see only tenant A; barber sees only their own rows.
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.barber_client_access
    where tenant_id <> '61000000-0000-4000-8000-000000000001'::uuid
  ) or not exists (select 1 from public.barber_client_access) then
    raise exception 'owner_rls_scope_failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.barber_client_access
    where tenant_id <> '61000000-0000-4000-8000-000000000001'::uuid
  ) or not exists (select 1 from public.barber_client_access) then
    raise exception 'manager_rls_scope_failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.barber_client_access
    where barber_id <> '63000000-0000-4000-8000-000000000002'::uuid
  ) or not exists (select 1 from public.barber_client_access) then
    raise exception 'barber_rls_scope_failed';
  end if;
end $$;
reset role;

rollback;

select 'barber_booking_access_db_tests_passed' as result;
