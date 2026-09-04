-- Review-after-10-bookings automation. Every fixture is rolled back.
begin;

do $$
declare
  v_user uuid;
  v_plan uuid;
  v_tenant uuid := '65000000-0000-4000-8000-000000000001';
  v_contact uuid := '65100000-0000-4000-8000-000000000001';
  v_secondary uuid := '65100000-0000-4000-8000-000000000002';
  v_barber uuid := '65200000-0000-4000-8000-000000000001';
  v_service uuid := '65300000-0000-4000-8000-000000000001';
  v_auto uuid;
  v_cond record;
  v_discover jsonb;
  v_run_count integer;
  v_conditions jsonb := '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_account_active":true,"require_onboarding_complete":true,"min_bookings":10}'::jsonb;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;

  select id into v_plan from public.plans where slug = 'pro' limit 1;
  if v_plan is null then raise exception 'test_plan_missing'; end if;

  select id into v_auto
  from public.marketing_automations
  where automation_key = 'review_after_10_bookings';
  if v_auto is null then
    raise exception 'review_automation_missing';
  end if;

  if exists (
    select 1 from public.marketing_automations
    where id = v_auto and is_active = true
  ) then
    raise exception 'review_automation_not_paused';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'review_request_active_user'
      and is_system_template = true
      and cta_url = 'https://staging.frizeo.ro/review'
      and cta_url_type = 'custom'
      and cta_text = 'Lasă-ne o recenzie'
  ) then
    raise exception 'review_template_missing_or_wrong_cta';
  end if;

  insert into public.tenants (id, name, slug)
  values (v_tenant, 'Review Ten', 'review-ten-bookings');

  insert into public.barbers (id, user_id, display_name, tenant_id, slug, active)
  values (v_barber, v_user, 'Review Barber', v_tenant, 'review-ten-barber', true);

  insert into public.barber_services (
    id, barber_id, tenant_id, name, display_name, duration, active
  ) values (v_service, v_barber, v_tenant, 'Tuns', 'Tuns', 30, true);

  insert into public.barber_weekly_schedule (
    barber_id, tenant_id, day_of_week, is_working, work_start, work_end
  ) values (v_barber, v_tenant, 1, true, '09:00', '18:00');

  insert into public.subscriptions (tenant_id, plan_id, status, created_at)
  values (v_tenant, v_plan, 'trialing', now() - interval '20 days');

  insert into public.tenant_users (tenant_id, user_id, role)
  values (v_tenant, v_user, 'owner');

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values
    (
      v_contact,
      'review.primary@example.com',
      'Review',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant,
      now() - interval '20 days'
    ),
    (
      v_secondary,
      'review.secondary@example.com',
      'Second',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      null,
      v_tenant,
      now() - interval '1 day'
    );

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  )
  select
    v_barber, v_tenant, v_service,
    date '2099-05-01' + g,
    time '09:00', time '09:30',
    'Client ' || g, '0700000000', 'confirmed'
  from generate_series(0, 8) g;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber, v_tenant, v_service,
    '2099-06-01', '10:00', '10:30', 'Cancelled', '0700000001', 'cancelled'
  );

  select * into v_cond
  from public.marketing_automation_condition_ok(v_contact, v_conditions);
  if v_cond.ok or v_cond.skip_reason <> 'bookings_below_threshold' then
    raise exception 'nine_confirmed_plus_cancelled_should_not_qualify: %', v_cond;
  end if;

  perform public.discover_marketing_automation_runs(50);
  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto and tenant_id = v_tenant and is_test = false
  ) then
    raise exception 'paused_review_automation_created_run';
  end if;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber, v_tenant, v_service,
    '2099-05-10', '09:00', '09:30', 'Tenth', '0700000002', 'confirmed'
  );

  select * into v_cond
  from public.marketing_automation_condition_ok(v_contact, v_conditions);
  if not v_cond.ok then
    raise exception 'ten_confirmed_should_qualify: %', v_cond;
  end if;

  update public.marketing_automations set is_active = true where id = v_auto;
  v_discover := public.discover_marketing_automation_runs(50);

  select count(*)::integer into v_run_count
  from public.marketing_automation_runs
  where automation_id = v_auto
    and tenant_id = v_tenant
    and is_test = false
    and status in ('pending', 'scheduled');
  if v_run_count <> 1 then
    raise exception 'expected_one_review_run_got_%: %', v_run_count, v_discover;
  end if;

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto and contact_id = v_secondary and is_test = false
  ) then
    raise exception 'secondary_contact_received_review_run';
  end if;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  )
  select
    v_barber, v_tenant, v_service,
    date '2099-07-01' + g,
    time '09:00', time '09:30',
    'Extra ' || g, '0700000003', 'confirmed'
  from generate_series(0, 4) g;

  perform public.discover_marketing_automation_runs(50);

  select count(*)::integer into v_run_count
  from public.marketing_automation_runs
  where automation_id = v_auto
    and tenant_id = v_tenant
    and is_test = false;
  if v_run_count <> 1 then
    raise exception 'extra_bookings_created_another_run_%', v_run_count;
  end if;

  update public.marketing_automation_runs
  set status = 'sent', sent_at = now(), completed_at = now()
  where automation_id = v_auto
    and tenant_id = v_tenant
    and is_test = false;

  perform public.discover_marketing_automation_runs(50);

  select count(*)::integer into v_run_count
  from public.marketing_automation_runs
  where automation_id = v_auto
    and tenant_id = v_tenant
    and is_test = false;
  if v_run_count <> 1 then
    raise exception 'sent_run_was_duplicated_%', v_run_count;
  end if;

  update public.marketing_automations set is_active = false where id = v_auto;

  raise notice 'review_after_10_bookings_ok';
end $$;

rollback;
