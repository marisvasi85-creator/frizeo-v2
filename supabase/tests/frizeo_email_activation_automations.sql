-- Activation automations. Every fixture is rolled back.
begin;

do $$
declare
  v_user uuid;
  v_plan_pro uuid;
  v_plan_plus uuid;
  v_tenant_incomplete uuid := '64000000-0000-4000-8000-000000000001';
  v_tenant_complete uuid := '64000000-0000-4000-8000-000000000002';
  v_contact_incomplete uuid := '64100000-0000-4000-8000-000000000001';
  v_contact_complete uuid := '64100000-0000-4000-8000-000000000002';
  v_barber_complete uuid := '64200000-0000-4000-8000-000000000002';
  v_service uuid := '64300000-0000-4000-8000-000000000001';
  v_auto_onboarding uuid;
  v_auto_booking uuid;
  v_auto_gcal uuid;
  v_auto_invite uuid;
  v_auto_inactive uuid;
  v_cond record;
  v_discover jsonb;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;

  select id into v_plan_pro from public.plans where slug = 'pro' limit 1;
  select id into v_plan_plus from public.plans where slug = 'pro-plus' limit 1;
  if v_plan_pro is null or v_plan_plus is null then
    raise exception 'test_plans_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key in (
      'incomplete_onboarding', 'inactive_account', 'no_first_booking',
      'connect_google_calendar', 'invite_team'
    )
    and is_system_template = true
  ) then
    raise exception 'activation_templates_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'incomplete_onboarding'
      and body_text like '%{{dashboard_url}}%'
      and body_text like '%{{services_url}}%'
      and body_text like '%{{schedule_url}}%'
      and body_text like '%{{booking_link}}%'
  ) then
    raise exception 'activation_onboarding_links_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'inactive_account'
      and body_text like '%{{dashboard_url}}%'
  ) then
    raise exception 'activation_inactive_links_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'no_first_booking'
      and body_text like '%{{booking_link}}%'
      and body_text like '%{{dashboard_url}}%'
  ) then
    raise exception 'activation_booking_links_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'connect_google_calendar'
      and body_text like '%{{profile_url}}%'
  ) then
    raise exception 'activation_profile_link_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'invite_team'
      and body_text like '%{{barbers_url}}%'
  ) then
    raise exception 'activation_barbers_link_missing';
  end if;

  select id into v_auto_onboarding
    from public.marketing_automations
    where automation_key = 'incomplete_onboarding_after_signup';
  select id into v_auto_booking
    from public.marketing_automations
    where automation_key = 'no_first_booking';
  select id into v_auto_gcal
    from public.marketing_automations
    where automation_key = 'google_calendar_after_signup';
  select id into v_auto_invite
    from public.marketing_automations
    where automation_key = 'invite_team_after_signup';
  select id into v_auto_inactive
    from public.marketing_automations
    where automation_key = 'inactive_account';

  if v_auto_onboarding is null or v_auto_booking is null
     or v_auto_gcal is null or v_auto_invite is null
     or v_auto_inactive is null then
    raise exception 'activation_automations_missing';
  end if;

  if exists (
    select 1 from public.marketing_automations
    where automation_key in (
      'incomplete_onboarding_after_signup',
      'inactive_account',
      'no_first_booking',
      'google_calendar_after_signup',
      'invite_team_after_signup'
    )
    and is_active = true
  ) then
    raise exception 'activation_automations_not_paused';
  end if;

  insert into public.tenants (id, name, slug) values
    (v_tenant_incomplete, 'Act Incomplete', 'act-incomplete'),
    (v_tenant_complete, 'Act Complete', 'act-complete');

  insert into public.barbers (id, user_id, display_name, tenant_id, slug, active)
  values
    (v_barber_complete, v_user, 'Act Complete Barber', v_tenant_complete, 'act-complete-barber', true);

  insert into public.barber_services (
    id, barber_id, tenant_id, name, display_name, duration, active
  ) values (
    v_service, v_barber_complete, v_tenant_complete, 'Tuns', 'Tuns', 30, true
  );

  insert into public.barber_weekly_schedule (
    barber_id, tenant_id, day_of_week, is_working, work_start, work_end
  ) values (
    v_barber_complete, v_tenant_complete, 1, true, '09:00', '18:00'
  );

  insert into public.subscriptions (tenant_id, plan_id, status, created_at)
  values
    (v_tenant_incomplete, v_plan_pro, 'trialing', now() - interval '2 days'),
    (v_tenant_complete, v_plan_plus, 'trialing', now() - interval '10 days');

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values
    (
      v_contact_incomplete,
      'act.incomplete@example.com',
      'Incomp',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant_incomplete,
      now() - interval '2 days'
    ),
    (
      v_contact_complete,
      'act.complete@example.com',
      'Comp',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant_complete,
      now() - interval '10 days'
    );

  if public.is_tenant_onboarding_complete(v_tenant_incomplete) then
    raise exception 'incomplete_tenant_marked_complete';
  end if;
  if not public.is_tenant_onboarding_complete(v_tenant_complete) then
    raise exception 'complete_tenant_not_complete';
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_incomplete,
    '{"require_eligible":true,"require_registered":true,"require_onboarding_incomplete":true}'::jsonb
  );
  if not v_cond.ok then
    raise exception 'incomplete_not_eligible: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_registered":true,"require_onboarding_incomplete":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'onboarding_complete' then
    raise exception 'complete_not_skipped: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_registered":true,"require_onboarding_complete":true,"max_bookings":0}'::jsonb
  );
  if not v_cond.ok then
    raise exception 'complete_zero_bookings_should_ok: %', v_cond;
  end if;

  insert into public.bookings (
    barber_id, tenant_id, barber_service_id, date, start_time, end_time,
    client_name, client_phone, status
  ) values (
    v_barber_complete, v_tenant_complete, v_service,
    '2099-03-01', '09:00', '09:30', 'First Client', '0745123456', 'confirmed'
  );

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_registered":true,"require_onboarding_complete":true,"max_bookings":0}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'bookings_exceeded' then
    raise exception 'first_booking_not_skipped: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_onboarding_complete":true,"require_google_calendar_disconnected":true}'::jsonb
  );
  if not v_cond.ok then
    raise exception 'gcal_disconnected_should_ok: %', v_cond;
  end if;

  update public.barbers
  set google_calendar_connected = true
  where id = v_barber_complete;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_onboarding_complete":true,"require_google_calendar_disconnected":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'google_calendar_connected' then
    raise exception 'gcal_connected_not_skipped: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_complete,
    '{"require_eligible":true,"require_pro_plus":true,"require_barber_seats_available":true}'::jsonb
  );
  if not v_cond.ok then
    raise exception 'pro_plus_seats_should_ok: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_incomplete,
    '{"require_eligible":true,"require_pro_plus":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'not_pro_plus' then
    raise exception 'pro_not_skipped: %', v_cond;
  end if;

  update public.marketing_automations
  set is_active = true
  where id in (v_auto_onboarding, v_auto_booking, v_auto_gcal, v_auto_invite);

  v_discover := public.discover_marketing_automation_runs(50);

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_onboarding
      and contact_id = v_contact_complete
      and is_test = false
  ) then
    raise exception 'onboarding_run_for_complete_tenant: %', v_discover;
  end if;

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_onboarding
      and contact_id = v_contact_incomplete
      and is_test = false
  ) then
    raise exception 'onboarding_run_missing_for_incomplete: %', v_discover;
  end if;

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_booking
      and contact_id = v_contact_complete
      and is_test = false
      and status in ('pending', 'scheduled')
  ) then
    raise exception 'no_booking_run_should_not_enqueue_after_first_booking';
  end if;

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_gcal
      and contact_id = v_contact_complete
      and is_test = false
      and status in ('pending', 'scheduled')
  ) then
    raise exception 'gcal_run_enqueued_while_connected';
  end if;

  -- Completing onboarding should skip a pending incomplete-onboarding run.
  insert into public.barbers (id, display_name, tenant_id, slug, active)
  values (
    '64200000-0000-4000-8000-000000000001',
    'Act Incomplete Barber',
    v_tenant_incomplete,
    'act-incomplete-barber',
    true
  );
  insert into public.barber_services (
    barber_id, tenant_id, name, display_name, duration, active
  ) values (
    '64200000-0000-4000-8000-000000000001',
    v_tenant_incomplete,
    'Tuns',
    'Tuns',
    30,
    true
  );
  insert into public.barber_weekly_schedule (
    barber_id, tenant_id, day_of_week, is_working, work_start, work_end
  ) values (
    '64200000-0000-4000-8000-000000000001',
    v_tenant_incomplete,
    1,
    true,
    '09:00',
    '18:00'
  );

  perform public.discover_marketing_automation_runs(50);

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_onboarding
      and contact_id = v_contact_incomplete
      and is_test = false
      and status in ('pending', 'scheduled')
  ) then
    raise exception 'pending_onboarding_not_skipped_after_complete';
  end if;

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_auto_onboarding
      and contact_id = v_contact_incomplete
      and status = 'skipped'
      and skip_reason = 'onboarding_complete'
  ) then
    raise exception 'onboarding_skip_reason_missing';
  end if;

  raise notice 'activation_automations_ok';
end $$;

rollback;
