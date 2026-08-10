-- Frizeo Email: official system templates and history-safe delete operations.
-- Scope is intentionally limited to marketing_* objects.

alter table public.marketing_email_templates
  add column if not exists template_key text,
  add column if not exists category text,
  add column if not exists recommended_audience text,
  add column if not exists automation_key text,
  add column if not exists cta_url_type text not null default 'custom',
  add column if not exists is_system_template boolean not null default false;

alter table public.marketing_email_templates
  drop constraint if exists marketing_email_templates_cta_url_type_check;
alter table public.marketing_email_templates
  add constraint marketing_email_templates_cta_url_type_check
  check (cta_url_type in ('custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans'));

create unique index if not exists marketing_email_templates_template_key_uidx
  on public.marketing_email_templates (template_key)
  where template_key is not null;
create index if not exists marketing_email_templates_system_category_idx
  on public.marketing_email_templates (is_system_template, category, name);

alter table public.marketing_campaigns
  add column if not exists cta_url_type text not null default 'custom',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_cta_url_type_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_cta_url_type_check
  check (cta_url_type in ('custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans'));

create index if not exists marketing_campaigns_active_created_idx
  on public.marketing_campaigns (created_at desc)
  where deleted_at is null;
create index if not exists marketing_campaigns_deleted_by_idx
  on public.marketing_campaigns (deleted_by)
  where deleted_by is not null;

alter table public.marketing_contacts
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_email_hash text;

create unique index if not exists marketing_contacts_deleted_email_hash_uidx
  on public.marketing_contacts (deleted_email_hash)
  where deleted_email_hash is not null;
create index if not exists marketing_contacts_active_created_idx
  on public.marketing_contacts (created_at desc)
  where deleted_at is null;
create index if not exists marketing_contacts_deleted_by_idx
  on public.marketing_contacts (deleted_by)
  where deleted_by is not null;

insert into public.marketing_email_templates (
  template_key, name, category, subject, preview_text, heading, body_text,
  image_url, cta_text, cta_url, cta_url_type, recommended_audience,
  automation_key, footer_text, is_system_template, is_default
)
values
  (
    'discover_frizeo', 'Descoperă Frizeo', 'lead',
    'Încă îți notezi programările în telefon sau WhatsApp?',
    'Lasă clienții să se programeze singuri, fără mesaje înainte și înapoi.',
    'Programările pot fi mult mai simple.',
    E'Frizeo este platforma de programări creată pentru frizeri, frizerii și saloane care vor să petreacă mai puțin timp răspunzând la mesaje și mai mult timp lucrând.\n\nÎți setezi programul, serviciile și disponibilitatea, distribui linkul tău de programări, iar clienții aleg singuri ziua și ora potrivită.',
    null, 'Încearcă Frizeo', null, 'register', 'leads', null,
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'created_by_barber', 'Creat de un frizer pentru frizeri', 'lead',
    'Frizeo a fost creat de un frizer pentru frizeri',
    'Construit pornind de la probleme reale din frizerie, nu dintr-un model generic.',
    'Creat din spatele scaunului de frizer.',
    E'Frizeo nu a pornit de la ideea de a construi încă un software generic pentru programări.\n\nA pornit dintr-o problemă simplă: telefoane, mesaje, programări scrise în agendă și clienți care întreabă la orice oră dacă mai este liber.\n\nDe aceea Frizeo pune lucrurile importante într-un singur loc: program, servicii, programări, link public și administrarea activității tale.',
    null, 'Vezi Frizeo', null, 'marketing', 'leads', null,
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'self_booking', 'Clienții se programează singuri', 'lead',
    'Clienții tăi se pot programa chiar și când tu lucrezi',
    'Tu îți setezi programul. Ei aleg singuri ora disponibilă.',
    'Programări la orice oră. Fără să răspunzi tu.',
    E'Un client vede linkul tău Frizeo, alege serviciul, ziua și ora disponibilă și își face singur programarea.\n\nPoate face asta dimineața, seara sau în timp ce tu ai un client pe scaun.\n\nTu doar îți verifici programul și serviciile, le ajustezi dacă vrei, apoi continui să lucrezi.',
    null, 'Creează contul', null, 'register', 'leads', null,
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'website_alternative', 'Alternativa la un site scump', 'lead',
    'Nu ai nevoie de un site de mii de lei pentru programări online',
    'Creează contul Frizeo și începe să primești programări online.',
    'Pagina ta de programări este deja aici.',
    E'Un site personalizat cu sistem de programări poate însemna costuri mari, mentenanță și timp pierdut.\n\nCu Frizeo îți creezi contul, primești un sistem pregătit pentru programări, verifici programul și serviciile și le modifici doar dacă ai nevoie.\n\nApoi distribui linkul tău pe Instagram, Facebook, WhatsApp sau Google.',
    null, 'Începe cu Frizeo', null, 'register', 'leads', null,
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'welcome_ready', 'Bine ai venit — cont pregătit', 'lifecycle',
    'Contul tău Frizeo este pregătit 👋',
    'Verifică programul și serviciile, apoi poți începe să primești programări.',
    'Frizeo este gata pentru tine.',
    E'Contul tău Frizeo este pregătit pentru programări.\n\nProgramul și serviciile sunt deja configurate. Îți recomandăm doar să le verifici și, dacă vrei, să le editezi astfel încât să corespundă exact modului în care lucrezi.\n\nDupă aceea, poți distribui linkul tău de programări clienților.',
    null, 'Verifică contul', null, 'dashboard', 'registered_users', 'USER_SIGNED_UP',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'check_schedule_services', 'Verifică programul și serviciile', 'lifecycle',
    'Ai verificat programul și serviciile din Frizeo?',
    'Totul este pregătit. Poți modifica programul sau serviciile dacă ai nevoie.',
    'Doar o verificare înainte să începi.',
    E'Frizeo este deja pregătit să primească programări.\n\nAruncă o privire peste programul de lucru și lista de servicii. Dacă totul este corect, nu trebuie să schimbi nimic.\n\nDacă vrei alte ore, alte durate sau alte servicii, le poți modifica oricând din dashboard.',
    null, 'Verifică programul și serviciile', null, 'dashboard', 'registered_users', 'ACCOUNT_READY_CHECK',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'share_booking_link', 'Distribuie linkul de programări', 'lifecycle',
    'Acum poți începe să primești programări prin Frizeo',
    'Trimite linkul tău clienților și lasă-i să își aleagă singuri ora.',
    'Contul este gata. Mai rămâne doar să-l folosești.',
    E'Programul și serviciile tale sunt pregătite.\n\nDistribuie linkul Frizeo pe WhatsApp, Instagram, Facebook sau oriunde comunică deja clienții cu tine.\n\nEi pot vedea orele disponibile și se pot programa singuri, fără să te mai întrebe când ai liber.',
    null, 'Vezi linkul meu', '{{booking_link}}', 'booking_link', 'registered_users', 'READY_TO_SHARE',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'trial_use_it', 'Trial — folosește-l cu clienți reali', 'trial',
    'Ai încercat să lași Frizeo să gestioneze programările pentru tine?',
    'Folosește perioada de test într-o zi normală de lucru.',
    'Cel mai bun test este să-l folosești cu clienți reali.',
    E'Perioada de test este cea mai utilă atunci când Frizeo intră în rutina ta normală.\n\nTrimite linkul câtorva clienți și lasă-i să își aleagă singuri programarea.\n\nDupă câteva programări vei vedea mult mai clar cât timp îți poate economisi.',
    null, 'Deschide Frizeo', null, 'dashboard', 'trial_active', 'TRIAL_ACTIVE_TIPS',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'trial_7_days', 'Trial — 7 zile rămase', 'trial',
    'Mai ai 7 zile de Frizeo',
    'Profită de perioada rămasă pentru a testa programările cu clienții tăi.',
    'Mai ai o săptămână de trial.',
    E'Perioada ta de test Frizeo se apropie de final.\n\nDacă încă nu ai distribuit linkul de programări clienților, acum este momentul potrivit să vezi cum funcționează într-o săptămână normală de lucru.',
    null, 'Intră în Frizeo', null, 'dashboard', 'trial_ending_7_days', 'TRIAL_ENDING_7_DAYS',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'trial_3_days', 'Trial — 3 zile rămase', 'trial',
    'Trial-ul Frizeo se încheie în 3 zile',
    'Păstrează programările online active după terminarea perioadei de test.',
    'Mai sunt 3 zile.',
    E'Trial-ul tău Frizeo se încheie în curând.\n\nDacă Frizeo ți-a simplificat programările și vrei să continui să folosești pagina ta, poți alege planul potrivit direct din cont.',
    null, 'Vezi planurile', null, 'plans', 'trial_ending_3_days', 'TRIAL_ENDING_3_DAYS',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'trial_last_day', 'Trial — ultima zi', 'trial',
    'Ultima zi de trial Frizeo',
    'Perioada ta de test se încheie în curând.',
    'Trial-ul tău se încheie astăzi.',
    E'Astăzi este ultima zi a perioadei tale de test Frizeo.\n\nPentru a continua să folosești programările online și configurația pe care o ai deja, alege planul potrivit activității tale.',
    null, 'Continuă cu Frizeo', null, 'plans', 'trial_last_day', 'TRIAL_EXPIRES_TOMORROW_OR_TODAY',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'trial_expired', 'Trial expirat', 'winback',
    'Trial-ul Frizeo s-a încheiat',
    'Contul tău este în continuare aici dacă vrei să continui.',
    'Frizeo este gata când ești și tu.',
    E'Perioada de test s-a încheiat.\n\nConfigurația contului tău rămâne disponibilă, astfel încât nu trebuie să începi din nou.\n\nDacă vrei să continui să folosești Frizeo pentru programări, îți poți activa planul direct din cont.',
    null, 'Reactivează Frizeo', null, 'plans', 'trial_expired', 'TRIAL_EXPIRED',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'winback_7_days', 'Win-back — după 7 zile', 'winback',
    'Mai vrei să folosești Frizeo pentru programările tale?',
    'Contul tău este pregătit și poți reveni oricând.',
    'Poți continua de unde ai rămas.',
    E'Au trecut câteva zile de când trial-ul Frizeo s-a încheiat.\n\nDacă încă gestionezi programările prin telefon, mesaje sau agendă, contul tău Frizeo este pregătit să preia din nou această parte a muncii.\n\nNu trebuie să refaci configurarea.',
    null, 'Revin în Frizeo', null, 'plans', 'trial_expired_no_subscription', 'TRIAL_EXPIRED_7_DAYS',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'subscription_active', 'Abonament activ', 'customer',
    'Frizeo este activ. Mulțumim!',
    'Programările tale Frizeo continuă fără întrerupere.',
    'Frizeo continuă să lucreze pentru tine.',
    E'Abonamentul tău este activ, iar pagina de programări continuă să fie disponibilă clienților.\n\nPoți administra programul, serviciile, frizerii și programările direct din dashboard.',
    null, 'Deschide dashboard-ul', null, 'dashboard', 'paid_customers', 'SUBSCRIPTION_ACTIVATED',
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  ),
  (
    'new_feature', 'Funcție nouă Frizeo', 'announcement',
    'Nou în Frizeo: {{feature_name}}',
    'Am adăugat o nouă funcție pentru a-ți face munca mai simplă.',
    '{{feature_name}} este acum disponibil.',
    E'Frizeo continuă să evolueze.\n\nAm adăugat {{feature_name}}, pentru a face administrarea programărilor și mai simplă.\n\n{{feature_description}}',
    null, 'Încearcă funcția', null, 'dashboard', 'registered_users', null,
    'Frizeo · Programări online pentru frizeri și saloane.', true, false
  )
on conflict (template_key) where template_key is not null do nothing;

create or replace function public.prevent_system_marketing_template_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system_template then
    raise exception 'system_template_protected';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_system_marketing_template on public.marketing_email_templates;
create trigger protect_system_marketing_template
before update or delete on public.marketing_email_templates
for each row execute function public.prevent_system_marketing_template_mutation();

create or replace function public.delete_marketing_contacts(
  p_contact_ids uuid[],
  p_deleted_by uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted_count integer;
  v_campaign_id uuid;
begin
  if p_contact_ids is null
     or cardinality(p_contact_ids) = 0
     or cardinality(p_contact_ids) > 200 then
    raise exception 'invalid_contact_selection';
  end if;
  if p_deleted_by is null or not exists (
    select 1 from public.platform_admins admin where admin.user_id = p_deleted_by
  ) then
    raise exception 'platform_admin_required';
  end if;

  perform 1
  from public.marketing_contacts contact
  where contact.id = any(p_contact_ids)
  order by contact.id
  for update;

  update public.marketing_contacts contact
  set deleted_email_hash = encode(extensions.digest(contact.email_normalized, 'sha256'), 'hex'),
      email = 'deleted+' || contact.id::text || '@contacts.invalid',
      first_name = null,
      last_name = null,
      phone = null,
      notes = null,
      user_id = null,
      tenant_id = null,
      status = 'unsubscribed',
      marketing_consent = false,
      unsubscribed_at = coalesce(contact.unsubscribed_at, now()),
      suppression_reason = 'deleted_by_platform_admin',
      deleted_at = now(),
      deleted_by = p_deleted_by,
      updated_at = now()
  where contact.id = any(p_contact_ids)
    and contact.deleted_at is null;

  get diagnostics v_deleted_count = row_count;

  update public.marketing_unsubscribe_tokens token
  set revoked_at = coalesce(token.revoked_at, now())
  where token.contact_id = any(p_contact_ids);

  for v_campaign_id in
    with skipped as (
      update public.marketing_campaign_recipients recipient
      set status = 'skipped',
          error_message = 'contact_deleted_by_platform_admin',
          next_attempt_at = null,
          claimed_at = null,
          claim_token = null,
          updated_at = now()
      from public.marketing_campaigns campaign
      where recipient.campaign_id = campaign.id
        and recipient.contact_id = any(p_contact_ids)
        and campaign.status in ('queued', 'sending')
        and recipient.status in ('pending', 'queued')
      returning recipient.campaign_id
    )
    select distinct skipped.campaign_id from skipped
  loop
    perform public.refresh_marketing_campaign_progress(v_campaign_id);
  end loop;

  return v_deleted_count;
end;
$$;

create or replace function public.delete_marketing_campaign(
  p_campaign_id uuid,
  p_deleted_by uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_deleted_at timestamptz;
begin
  if p_deleted_by is null or not exists (
    select 1 from public.platform_admins admin where admin.user_id = p_deleted_by
  ) then
    raise exception 'platform_admin_required';
  end if;

  select campaign.status, campaign.deleted_at
    into v_status, v_deleted_at
  from public.marketing_campaigns campaign
  where campaign.id = p_campaign_id
  for update;

  if not found or v_deleted_at is not null then
    return 'not_found';
  end if;

  if v_status = 'draft' then
    delete from public.marketing_campaigns where id = p_campaign_id;
    return 'deleted';
  end if;

  if v_status in ('scheduled', 'queued', 'sending') then
    return 'active_protected';
  end if;

  update public.marketing_campaigns
  set deleted_at = now(), deleted_by = p_deleted_by, updated_at = now()
  where id = p_campaign_id;
  return 'archived';
end;
$$;

revoke all on function public.delete_marketing_contacts(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.delete_marketing_contacts(uuid[], uuid) to service_role;
revoke all on function public.delete_marketing_campaign(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_marketing_campaign(uuid, uuid) to service_role;

comment on column public.marketing_contacts.deleted_email_hash is
  'SHA-256 of the normalized email retained only to prevent accidental re-import after PII anonymization.';
comment on column public.marketing_campaigns.deleted_at is
  'Soft-delete/archive marker. Historical recipients, delivery events and analytics remain intact.';
