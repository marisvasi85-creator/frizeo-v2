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
  v_barber_other_tenant uuid := '63000000-0000-4000-8000-000000000003';
  v_service_a uuid := '64000000-0000-4000-8000-000000000001';
  v_service_b uuid := '64000000-0000-4000-8000-000000000002';
  v_service_other uuid := '64000000-0000-4000-8000-000000000003';
  v_existing_booking uuid := '65000000-0000-4000-8000-000000000001';
  v_count_before integer;
  v_count_after integer;
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
    (v_barber_other_tenant, v_other_owner, 'Access Barber C', v_tenant_b, 'access-barber-c');

  if (select booking_access_mode from public.barbers where id = v_barber_a) <> 'open' then
    raise exception 'booking_access_default_is_not_open';
  end if;

  insert into public.barber_services (
    id, barber_id, tenant_id, name, display_name, duration, price
  ) values
    (v_service_a, v_barber_a, v_tenant_a, 'Test', 'Test', 30, 50),
    (v_service_b, v_barber_b, v_tenant_a, 'Test', 'Test', 30, 50),
    (v_service_other, v_barber_other_tenant, v_tenant_b, 'Test', 'Test', 30, 50);

  if public.normalize_ro_phone('0745 123 456') <> '40745123456'
    or public.normalize_ro_phone('+40 745 123 456') <> '40745123456'
    or public.normalize_ro_phone('0040 745 123 456') <> '40745123456' then
    raise exception 'phone_normalization_failed';
  end if;

  -- The current open flow remains valid and creates a normal confirmed booking.
  insert into public.bookings (
    id, barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_existing_booking, v_barber_a, v_tenant_a, v_service_a,
    '2099-02-01', '09:00', '09:30', 'Existing Client', '0745 123 456', 'confirmed'
  );

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_a, v_tenant_a, v_service_a,
    '2099-02-02', '09:00', '09:30', 'Existing Client Updated', '+40 745 123 456', 'cancelled'
  );

  if (
    select count(*) from public.barber_existing_clients
    where tenant_id = v_tenant_a
      and barber_id = v_barber_a
      and phone_normalized = '40745123456'
  ) <> 1 then
    raise exception 'existing_client_deduplication_failed';
  end if;

  if (
    select appointment_count from public.barber_existing_clients
    where tenant_id = v_tenant_a
      and barber_id = v_barber_a
      and phone_normalized = '40745123456'
  ) <> 2 then
    raise exception 'existing_client_appointment_aggregation_failed';
  end if;

  select count(*) into v_count_before from public.bookings where id = v_existing_booking;
  update public.barbers set booking_access_mode = 'approval_required' where id in (v_barber_a, v_barber_b);
  select count(*) into v_count_after from public.bookings where id = v_existing_booking;
  if v_count_before <> v_count_after then
    raise exception 'existing_booking_changed_during_mode_transition';
  end if;

  -- An existing confirmed appointment keeps the current reschedule path even
  -- after the barber becomes restrictive.
  perform public.reschedule_booking_safe(
    v_existing_booking,
    '2099-02-08',
    '11:00',
    'Existing Client',
    '+40 745 123 456',
    null,
    null,
    v_service_a
  );
  if (select status from public.bookings where id = v_existing_booking) <> 'cancelled' then
    raise exception 'existing_booking_reschedule_failed';
  end if;

  -- Direct database creation is rejected until this barber/phone is approved.
  begin
    insert into public.bookings (
      barber_id, tenant_id, barber_service_id, date, start_time, end_time,
      client_name, client_phone, status
    ) values (
      v_barber_a, v_tenant_a, v_service_a,
      '2099-02-03', '09:00', '09:30', 'Unapproved', '0745 222 222', 'confirmed'
    );
    raise exception 'unapproved_direct_booking_allowed';
  exception when others then
    if sqlerrm = 'unapproved_direct_booking_allowed' then raise; end if;
    if position('BOOKING_ACCESS_REQUIRED' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_a, v_barber_a, '40745222222', 'Approval Test', 'pending', 'client_request'
  );

  -- pending / rejected / blocked all remain ineligible.
  foreach v_count_before in array array[1, 2, 3]
  loop
    update public.barber_client_access
    set status = case v_count_before when 1 then 'pending' when 2 then 'rejected' else 'blocked' end
    where barber_id = v_barber_a and phone_normalized = '40745222222';

    begin
      insert into public.bookings (
        barber_id, tenant_id, barber_service_id, date, start_time, end_time,
        client_name, client_phone, status
      ) values (
        v_barber_a, v_tenant_a, v_service_a,
        ('2099-02-0' || (3 + v_count_before)::text)::date,
        '10:00', '10:30', 'Approval Test', '+40745222222', 'confirmed'
      );
      raise exception 'non_approved_status_allowed_booking';
    exception when others then
      if sqlerrm = 'non_approved_status_allowed_booking' then raise; end if;
      if position('BOOKING_ACCESS_REQUIRED' in sqlerrm) = 0 then raise; end if;
    end;
  end loop;

  update public.barber_client_access
  set status = 'approved', decision_source = 'manual_admin', decided_at = now(), decided_by = v_owner
  where barber_id = v_barber_a and phone_normalized = '40745222222';

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_a, v_tenant_a, v_service_a,
    '2099-02-07', '10:00', '10:30', 'Approval Test', '0040 745 222 222', 'confirmed'
  );

  -- Approval is per barber, never salon-wide.
  update public.barbers set booking_access_mode = 'approved_only' where id = v_barber_b;
  begin
    insert into public.bookings (
      barber_id, tenant_id, barber_service_id, date, start_time, end_time,
      client_name, client_phone, status
    ) values (
      v_barber_b, v_tenant_a, v_service_b,
      '2099-02-07', '10:00', '10:30', 'Approval Test', '0745 222 222', 'confirmed'
    );
    raise exception 'approval_leaked_between_barbers';
  exception when others then
    if sqlerrm = 'approval_leaked_between_barbers' then raise; end if;
    if position('BOOKING_ACCESS_REQUIRED' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_a, v_barber_b, '40745222222', 'Approval Test', 'approved', 'manual_admin'
  );

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_b, v_tenant_a, v_service_b,
    '2099-02-08', '10:00', '10:30', 'Approval Test', '0745 222 222', 'confirmed'
  );

  -- Atomic upsert is idempotent and the unique key prevents duplicates.
  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values (
    v_tenant_a, v_barber_a, '40745222222', 'Approval Test', 'approved', 'manual_admin'
  ) on conflict (barber_id, phone_normalized)
    do update set status = excluded.status;

  if (
    select count(*) from public.barber_client_access
    where barber_id = v_barber_a and phone_normalized = '40745222222'
  ) <> 1 then
    raise exception 'duplicate_access_relationship_created';
  end if;

  -- Bulk approval is one atomic, idempotent upsert over deduplicated booking
  -- history and creates no second client/contact table.
  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, client_email,
    status, source, decision_source
  )
  select
    tenant_id, barber_id, phone_normalized,
    coalesce(client_name, 'Client existent'), client_email,
    'approved', 'existing_client', 'existing_client'
  from public.barber_existing_clients
  where tenant_id = v_tenant_a and barber_id = v_barber_a
  on conflict (barber_id, phone_normalized)
  do update set status = excluded.status;

  if (
    select count(*) from public.barber_client_access
    where barber_id = v_barber_a and status = 'approved'
  ) <> 2 then
    raise exception 'bulk_existing_client_approval_failed';
  end if;

  -- The composite FK prevents a relationship from carrying another tenant.
  begin
    insert into public.barber_client_access (
      tenant_id, barber_id, phone_normalized, client_name, status, source
    ) values (
      v_tenant_b, v_barber_a, '40745999999', 'Wrong tenant', 'approved', 'manual_admin'
    );
    raise exception 'cross_tenant_access_row_allowed';
  exception when foreign_key_violation then null;
  end;

  update public.barber_client_access
  set status = 'pending'
  where barber_id = v_barber_b and phone_normalized = '40745222222';

  insert into public.barber_client_access (
    tenant_id, barber_id, phone_normalized, client_name, status, source
  ) values
    (v_tenant_b, v_barber_other_tenant, '40745444444', 'Tenant B Client', 'pending', 'client_request');

  raise notice 'barber_booking_access_data_tests_ok';
end $$;

-- RLS: tenant owner and manager can see tenant A, the barber only their own
-- rows, and nobody can read another tenant's access list.
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.barber_client_access) <> 3 then
    raise exception 'owner_rls_scope_failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.barber_client_access) <> 3 then
    raise exception 'manager_rls_scope_failed';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.barber_client_access) <> 1
    or exists (
      select 1 from public.barber_client_access
      where barber_id <> '63000000-0000-4000-8000-000000000002'::uuid
    ) then
    raise exception 'barber_rls_scope_failed';
  end if;
end $$;
reset role;

rollback;

select 'barber_booking_access_db_tests_passed' as result;
