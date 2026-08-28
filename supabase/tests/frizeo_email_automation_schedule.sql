-- Lock day/template mapping and Bucharest trial-calendar discovery / claim join.
begin;

do $$
declare
  v_plan_id uuid;
  v_user uuid;
  v_tenant uuid := '62000000-0000-4000-8000-000000000021';
  v_contact uuid := '61000000-0000-4000-8000-000000000021';
  v_welcome uuid;
  v_trial7 uuid;
  v_trial3 uuid;
  v_run_id uuid;
  v_claim_count integer;
  v_today date := timezone('Europe/Bucharest', now())::date;
  v_trial_end timestamptz;
  v_mapping record;
  v_discover jsonb;
begin
  select id into v_plan_id from public.plans where slug = 'pro' limit 1;
  if v_plan_id is null then raise exception 'test_plan_missing'; end if;
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;

  -- Canonical automation_key → delay → template_key.
  for v_mapping in
    select * from (
      values
        ('welcome_after_signup', 'user_signed_up', 0, 'welcome_ready'),
        ('check_schedule_services_after_signup', 'user_signed_up', 1440, 'check_schedule_services'),
        ('share_booking_link_after_signup', 'user_signed_up', 2880, 'share_booking_link'),
        ('google_visibility_after_signup', 'user_signed_up', 4320, 'google_visibility'),
        ('trial_active_tips', 'trial_started', 10080, 'trial_use_it'),
        ('trial_ending_7_days', 'trial_ending_7_days', 0, 'trial_7_days'),
        ('trial_ending_3_days', 'trial_ending_3_days', 0, 'trial_3_days'),
        ('trial_last_day', 'trial_last_day', 0, 'trial_last_day'),
        ('trial_expired', 'trial_expired', 1440, 'trial_expired'),
        ('trial_expired_7_days', 'trial_expired', 10080, 'winback_7_days'),
        ('subscription_activated', 'subscription_activated', 0, 'subscription_active')
    ) as expected(automation_key, trigger_type, delay_minutes, template_key)
  loop
    if not exists (
      select 1
      from public.marketing_automations automation
      join public.marketing_email_templates template
        on template.id = automation.template_id
      where automation.automation_key = v_mapping.automation_key
        and automation.trigger_type = v_mapping.trigger_type
        and automation.delay_minutes = v_mapping.delay_minutes
        and template.template_key = v_mapping.template_key
        and template.is_system_template = true
    ) then
      raise exception 'automation_template_mismatch: %', v_mapping;
    end if;
  end loop;

  insert into public.tenants (id, name, slug)
  values (v_tenant, 'Schedule Trial', 'schedule-trial');

  -- 00:30 Europe/Bucharest on today+7 is still the previous calendar day in UTC.
  v_trial_end := timezone(
    'Europe/Bucharest',
    ((v_today + 7)::timestamp + interval '30 minutes')
  );

  if public.marketing_bucharest_date(v_trial_end) <> v_today + 7 then
    raise exception 'bucharest_date_helper_wrong: % vs %',
      public.marketing_bucharest_date(v_trial_end), v_today + 7;
  end if;

  if (timezone('UTC', v_trial_end))::date =
     public.marketing_bucharest_date(v_trial_end) then
    raise exception 'fixture_did_not_cross_utc_midnight: %', v_trial_end;
  end if;

  insert into public.subscriptions (
    tenant_id, plan_id, status, stripe_subscription_id, trial_ends_at, created_at
  ) values
    (
      v_tenant,
      v_plan_id,
      'trialing',
      null,
      v_trial_end,
      now() - interval '20 days'
    ),
    (
      v_tenant,
      v_plan_id,
      'canceled',
      null,
      v_trial_end - interval '40 days',
      now() - interval '60 days'
    );

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values (
    v_contact,
    'schedule.trial@example.com',
    'Schedule',
    'frizeo_user',
    'subscribed',
    true,
    'test',
    now(),
    v_user,
    v_tenant,
    now() - interval '2 days'
  ), (
    '61000000-0000-4000-8000-000000000022',
    'schedule.secondary@example.com',
    'Secondary',
    'frizeo_user',
    'subscribed',
    true,
    'test',
    now(),
    v_user,
    v_tenant,
    now() - interval '1 day'
  );

  select id into v_welcome
  from public.marketing_automations
  where automation_key = 'welcome_after_signup';
  select id into v_trial7
  from public.marketing_automations
  where automation_key = 'trial_ending_7_days';
  select id into v_trial3
  from public.marketing_automations
  where automation_key = 'trial_ending_3_days';

  update public.marketing_automations
  set is_active = true
  where id in (v_welcome, v_trial7, v_trial3);

  v_discover := public.discover_marketing_automation_runs(50);

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_trial7
      and contact_id = v_contact
      and is_test = false
  ) then
    raise exception 'trial_7_not_discovered_on_bucharest_day: % %', v_discover, v_trial_end;
  end if;

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_trial7
      and contact_id = '61000000-0000-4000-8000-000000000022'
      and is_test = false
  ) then
    raise exception 'trial_7_sent_to_secondary_contact';
  end if;

  if (
    select count(*) from public.marketing_automation_runs
    where automation_id = v_trial7
      and tenant_id = v_tenant
      and is_test = false
  ) <> 1 then
    raise exception 'trial_7_not_unique_per_tenant';
  end if;

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_trial3
      and contact_id = v_contact
      and is_test = false
      and scheduled_for > now()
  ) then
    raise exception 'trial_3_not_scheduled_ahead_on_7_day_fixture';
  end if;

  insert into public.tenants (id, name, slug)
  values ('62000000-0000-4000-8000-000000000023', 'Schedule Catchup', 'schedule-catchup');

  insert into public.subscriptions (
    tenant_id, plan_id, status, stripe_subscription_id, trial_ends_at, created_at
  ) values (
    '62000000-0000-4000-8000-000000000023',
    v_plan_id,
    'trialing',
    null,
    timezone(
      'Europe/Bucharest',
      ((v_today + 5)::timestamp + interval '30 minutes')
    ),
    now() - interval '20 days'
  );

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values (
    '61000000-0000-4000-8000-000000000023',
    'schedule.catchup@example.com',
    'Catchup',
    'frizeo_user',
    'subscribed',
    true,
    'test',
    now(),
    v_user,
    '62000000-0000-4000-8000-000000000023',
    now() - interval '20 days'
  );

  perform public.discover_marketing_automation_runs(50);

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_trial7
      and contact_id = '61000000-0000-4000-8000-000000000023'
      and is_test = false
      and scheduled_for < now()
  ) then
    raise exception 'trial_7_catchup_not_scheduled_when_5_days_remain';
  end if;

  update public.marketing_automation_runs
  set scheduled_for = now() - interval '1 minute',
      next_attempt_at = now() - interval '1 minute'
  where automation_id = v_welcome
    and contact_id = v_contact;

  select count(*)::integer into v_claim_count
  from public.claim_marketing_automation_run_batch(5, 600, 4)
  where automation_id = v_welcome;

  if v_claim_count <> 1 then
    raise exception 'claim_duplicated_by_subscription_join: %', v_claim_count;
  end if;

  select run_id into v_run_id
  from public.claim_marketing_automation_run_batch(5, 600, 4)
  where automation_id = v_welcome
  limit 1;

  if v_run_id is not null then
    raise exception 'claimed_run_was_returned_twice';
  end if;

  raise notice 'automation_schedule_ok';
end $$;

rollback;
