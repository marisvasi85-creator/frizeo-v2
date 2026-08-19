-- Google visibility automation tests. Every fixture is rolled back.
begin;

do $$
declare
  v_user uuid;
  v_tenant_no_addr uuid := '62000000-0000-4000-8000-000000000010';
  v_tenant_with_addr uuid := '62000000-0000-4000-8000-000000000011';
  v_contact_no_addr uuid := '61000000-0000-4000-8000-000000000010';
  v_contact_with_addr uuid := '61000000-0000-4000-8000-000000000011';
  v_google_auto uuid;
  v_cond record;
  v_discover jsonb;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;

  select id into v_google_auto
  from public.marketing_automations
  where automation_key = 'google_visibility_after_signup';

  if v_google_auto is null then
    raise exception 'google_visibility_automation_missing';
  end if;

  if not exists (
    select 1 from public.marketing_email_templates
    where template_key = 'google_visibility'
      and is_system_template = true
      and cta_url_type = 'salon'
  ) then
    raise exception 'google_visibility_template_missing_or_wrong_cta';
  end if;

  insert into public.tenants (id, name, slug) values
    (v_tenant_no_addr, 'GV No Addr', 'gv-no-addr'),
    (v_tenant_with_addr, 'GV With Addr', 'gv-with-addr');

  update public.tenants
  set location_address_line = 'Str. Test 1',
      location_city = 'Arad',
      location_county = 'Arad'
  where id = v_tenant_with_addr;

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values
    (
      v_contact_no_addr,
      'gv.noaddr@example.com',
      'NoAddr',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant_no_addr,
      now() - interval '4 days'
    ),
    (
      v_contact_with_addr,
      'gv.withaddr@example.com',
      'WithAddr',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant_with_addr,
      now() - interval '4 days'
    );

  if public.is_tenant_salon_address_complete(v_tenant_no_addr) then
    raise exception 'no_addr_tenant_marked_complete';
  end if;

  if not public.is_tenant_salon_address_complete(v_tenant_with_addr) then
    raise exception 'with_addr_tenant_not_complete';
  end if;

  update public.marketing_automations
  set is_active = true
  where id = v_google_auto;

  v_discover := public.discover_marketing_automation_runs(50);

  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_google_auto
      and contact_id = v_contact_with_addr
      and is_test = false
  ) then
    raise exception 'run_created_for_complete_address_at_discovery';
  end if;

  if not exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_google_auto
      and contact_id = v_contact_no_addr
      and is_test = false
  ) then
    raise exception 'run_missing_for_incomplete_address: %', v_discover;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_no_addr,
    '{"require_eligible":true,"require_registered":true,"require_incomplete_salon_address":true}'::jsonb
  );
  if not v_cond.ok then
    raise exception 'incomplete_address_not_eligible: %', v_cond;
  end if;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_with_addr,
    '{"require_eligible":true,"require_registered":true,"require_incomplete_salon_address":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'salon_address_complete' then
    raise exception 'complete_address_not_skipped: %', v_cond;
  end if;

  update public.tenants
  set location_address_line = 'Str. Test 2',
      location_city = 'Timișoara'
  where id = v_tenant_no_addr;

  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_contact_no_addr,
    '{"require_eligible":true,"require_registered":true,"require_incomplete_salon_address":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'salon_address_complete' then
    raise exception 'address_completed_before_execution_not_skipped: %', v_cond;
  end if;

  raise notice 'google_visibility_automation_ok';
end $$;

rollback;
