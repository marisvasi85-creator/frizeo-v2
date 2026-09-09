-- Lifecycle v2 templates + automation retargeting.
-- Does not activate automations and does not delete existing rows.

BEGIN;

INSERT INTO public.marketing_email_templates (
  template_key, name, category, subject, preview_text, heading, body_text,
  image_url, cta_text, cta_url, cta_url_type, recommended_audience,
  automation_key, footer_text, is_system_template, is_default
)
VALUES
(
  'setup_help_day5',
  'Ajutor setup — ziua 5',
  'lifecycle',
  'Ai nevoie de o mână de ajutor cu Frizeo?',
  'Răspunde la acest email și te ghidăm noi.',
  'Suntem aici dacă te-ai blocat',
  E'Salut, {{first_name}}!\n\nAm văzut că setup-ul nu e încă gata. E ok — durează câteva minute.\n\nDacă ceva e neclar (servicii, program sau linkul de booking), răspunde aici și te ajutăm punctual.\n\nDashboard: {{dashboard_url}}',
  null,
  'Deschide dashboard-ul',
  null,
  'dashboard',
  'registered_users',
  'SETUP_HELP_DAY5',
  'Frizeo · poți continua gratuit, cu 80 de programări pe lună.',
  true,
  false
),
(
  'setup_abandon_survey',
  'De ce te-ai oprit din setup?',
  'lifecycle',
  'Un click: de ce nu ai terminat configurarea?',
  'Ne ajută să înțelegem ce lipsește.',
  'Ce te-a oprit?',
  E'Salut, {{first_name}}!\n\nNu vrem să te agasăm. Dacă Frizeo nu e potrivit acum, e în regulă.\n\nDacă vrei, răspunde cu un cuvânt: timp / neclar / nu am clienți încă / altceva.\n\nDacă te răzgândești, dashboard-ul rămâne aici: {{dashboard_url}}',
  null,
  'Revino în Frizeo',
  null,
  'dashboard',
  'registered_users',
  'SETUP_ABANDON_SURVEY',
  'Frizeo · programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'zero_bookings_activation',
  'Prima programare sau linkul pe WhatsApp',
  'lifecycle',
  'Două variante ca să pornești agenda în Frizeo',
  'Adaugă o programare existentă sau trimite linkul unui client.',
  'Agenda e gata. Lipsește primul pas',
  E'Salut, {{first_name}}!\n\nSetup-ul e complet, dar încă nu există nicio programare.\n\nAlege una:\n1. Adaugă tu o programare deja stabilită (din Dashboard → Programări).\n2. Trimite linkul unui client pe WhatsApp.\n\nLinkul tău:\n{{booking_link}}\n\nNu trebuie să faci ambele. Un singur pas e destul ca să vezi Frizeo în acțiune.',
  null,
  'Deschide programările',
  null,
  'dashboard',
  'registered_users',
  'ZERO_BOOKINGS_ACTIVATION',
  'Frizeo · poți continua gratuit, cu 80 de programări pe lună.',
  true,
  false
),
(
  'zero_bookings_help',
  'Ajutor personal — zero programări',
  'lifecycle',
  'Te ajut eu să pui prima programare în Frizeo',
  'Un mesaj scurt, fără presiune.',
  'Hai să pornim agenda împreună',
  E'Salut, {{first_name}}!\n\nDacă nu e clar de unde începi, răspunde la acest email. Te ghidăm: fie adăugăm prima programare, fie pregătim mesajul pentru WhatsApp cu linkul tău.\n\n{{booking_link}}',
  null,
  'Intră în cont',
  null,
  'dashboard',
  'registered_users',
  'ZERO_BOOKINGS_HELP',
  'Frizeo · programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'zero_bookings_survey',
  'De ce nu folosești încă Frizeo?',
  'lifecycle',
  'Un sondaj scurt: ce te-a oprit?',
  'Ultimul mesaj de activare.',
  'Ne oprește aici, dacă vrei',
  E'Salut, {{first_name}}!\n\nNu îți mai trimitem mesaje de activare după acesta.\n\nDacă ai 10 secunde, spune-ne de ce nu ai folosit încă Frizeo: nu am avut timp / clienții rezervă altfel / e complicat / nu e pentru mine.\n\nContul rămâne activ. Poți continua gratuit, cu 80 de programări pe lună.',
  null,
  'Deschide Frizeo',
  null,
  'dashboard',
  'registered_users',
  'ZERO_BOOKINGS_SURVEY',
  'Frizeo · 80 programări / lună pe planul Free.',
  true,
  false
),
(
  'at_risk_ask_problem',
  'Ce s-a întâmplat în salon?',
  'lifecycle',
  'Ai avut programări, apoi s-a oprit. Totul ok?',
  'Un mesaj scurt pentru saloane care au fost active.',
  'Ne poți spune ce s-a schimbat?',
  E'Salut, {{first_name}}!\n\nAi folosit Frizeo, apoi agenda s-a oprit. Dacă e o problemă tehnică, un client sau timpul tău, răspunde aici — fără presiune.\n\nPoți continua oricând gratuit, în limita a 80 de programări pe lună.',
  null,
  'Revino în Frizeo',
  null,
  'dashboard',
  'registered_users',
  'AT_RISK_ASK_PROBLEM',
  'Frizeo · programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'winback_last',
  'Ultimul mesaj de revenire',
  'lifecycle',
  'Închidem aici. Contul rămâne al tău.',
  'Fără follow-up după acest email.',
  'Ușa rămâne deschisă',
  E'Salut, {{first_name}}!\n\nAcesta e ultimul mesaj de revenire.\n\nDacă vrei să reiei programările, dashboard-ul e neschimbat. După trial poți continua gratuit, cu 80 de programări pe lună.\n\nSpor la treabă când ești gata.',
  null,
  'Deschide dashboard-ul',
  null,
  'dashboard',
  'registered_users',
  'WINBACK_LAST',
  'Frizeo · plan Free: 80 programări / lună.',
  true,
  false
),
(
  'trial_ending_unactivated',
  'Trial aproape gata, fără programări',
  'lifecycle',
  'Trialul se încheie. Poți continua gratuit.',
  'Fără countdown agresiv. Vrem doar să înțelegem de ce nu ai pornit.',
  'Nu pierzi accesul',
  E'Salut, {{first_name}}!\n\nTrialul se apropie de final, dar nu am văzut programări în Frizeo.\n\nDupă trial nu rămâi fără aplicație: treci pe Free, cu 80 de programări pe lună.\n\nDacă ceva te-a blocat, răspunde cu motivul. Dacă nu e momentul, e ok.',
  null,
  'Deschide Frizeo',
  null,
  'dashboard',
  'registered_users',
  'TRIAL_ENDING_UNACTIVATED',
  'Frizeo · Free = 80 programări / lună după trial.',
  true,
  false
),
(
  'value_summary_5_bookings',
  'Rezumat după 5 programări',
  'lifecycle',
  'Ai 5 programări în Frizeo. Iată de ce contează',
  'Un rezumat scurt, fără tutorial.',
  'Agenda a prins ritm',
  E'Salut, {{first_name}}!\n\nAi trecut de primele programări. Clienții au un loc clar unde să rezerve, iar tu vezi totul într-un singur calendar.\n\nUrmătorul pas, doar dacă e relevant: pune linkul în Google / bio sau conectează Google Calendar ca să eviți dublurile.\n\n{{booking_link}}',
  null,
  'Vezi programările',
  null,
  'dashboard',
  'registered_users',
  'VALUE_SUMMARY_5',
  'Frizeo · programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'free_plan_limit_hint',
  'Aproape de limita Free',
  'lifecycle',
  'Te apropii de 80 de programări luna aceasta',
  'Planul Free rămâne, upgrade-ul e opțional.',
  'Folosești Frizeo serios',
  E'Salut, {{first_name}}!\n\nEști aproape de limita de 80 de programări pe lună a planului Free.\n\nPoți rămâne pe Free și luna următoare, sau poți vedea planul plătit dacă ai nevoie de volum mai mare. Fără presiune — upgrade-ul are sens doar dacă agenda e plină.',
  null,
  'Vezi planurile',
  null,
  'plans',
  'registered_users',
  'FREE_PLAN_LIMIT_HINT',
  'Frizeo · Free include 80 de programări / lună.',
  true,
  false
)
ON CONFLICT (template_key) DO NOTHING;

UPDATE public.marketing_email_templates
SET
  subject = 'Trialul s-a încheiat. Continui gratuit, cu 80 programări/lună',
  preview_text = 'Nu pierzi accesul. Trecerea pe Free e automată.',
  heading = 'Contul rămâne activ pe Free',
  body_text = E'Salut, {{first_name}}!\n\nTrialul s-a încheiat. Nu îți închidem contul.\n\nDe azi ești pe planul Free: poți continua să folosești Frizeo, cu maximum 80 de programări pe lună.\n\nDacă agenda crește, planurile plătite sunt acolo. Până atunci, lucrezi normal.'
WHERE template_key = 'trial_expired'
  AND is_system_template = true;

INSERT INTO public.marketing_automations (
  automation_key, name, description, trigger_type, delay_minutes,
  template_id, conditions, is_system, is_active, priority
)
SELECT
  seed.automation_key,
  seed.name,
  seed.description,
  seed.trigger_type,
  seed.delay_minutes,
  template.id,
  seed.conditions::jsonb,
  true,
  false,
  seed.priority
FROM (
  VALUES
    (
      'setup_incomplete_help_day5',
      'Setup incomplet — ajutor ziua 5',
      'Mesaj scurt de ajutor dacă onboardingul e încă incomplet.',
      'user_signed_up',
      7200,
      'setup_help_day5',
      '{"require_eligible":true,"require_registered":true,"require_onboarding_incomplete":true,"lifecycle_v2":true,"required_stages":["signup_incomplete"],"lifecycle_anchor":"signup","delay_minutes_v2":7200,"required_next_best_action":"complete_onboarding"}',
      20
    ),
    (
      'setup_incomplete_survey_day10',
      'Setup incomplet — sondaj ziua 10',
      'Întrebare privind abandonul. Apoi fluxul se oprește.',
      'user_signed_up',
      14400,
      'setup_abandon_survey',
      '{"require_eligible":true,"require_registered":true,"require_onboarding_incomplete":true,"lifecycle_v2":true,"required_stages":["signup_incomplete"],"lifecycle_anchor":"signup","delay_minutes_v2":14400}',
      50
    ),
    (
      'zero_bookings_activation',
      'Setup complet, zero programări — activare',
      'Un email cu două acțiuni: programare manuală sau link WhatsApp.',
      'user_signed_up',
      2880,
      'zero_bookings_activation',
      '{"require_eligible":true,"require_registered":true,"require_onboarding_complete":true,"max_bookings":0,"lifecycle_v2":true,"required_stages":["setup_complete_zero_bookings"],"lifecycle_anchor":"stage_entered_at","delay_minutes_v2":2880,"required_next_best_action":"add_first_manual_booking"}',
      30
    ),
    (
      'zero_bookings_help',
      'Setup complet, zero programări — ajutor',
      'Mesaj personal dacă salonul e eligibil și tot fără programări.',
      'user_signed_up',
      7200,
      'zero_bookings_help',
      '{"require_eligible":true,"require_registered":true,"require_onboarding_complete":true,"max_bookings":0,"lifecycle_v2":true,"required_stages":["setup_complete_zero_bookings"],"lifecycle_anchor":"stage_entered_at","delay_minutes_v2":7200}',
      30
    ),
    (
      'zero_bookings_survey',
      'Setup complet, zero programări — sondaj',
      'Ultimul mesaj de activare pentru saloane fără programări.',
      'user_signed_up',
      14400,
      'zero_bookings_survey',
      '{"require_eligible":true,"require_registered":true,"require_onboarding_complete":true,"max_bookings":0,"lifecycle_v2":true,"required_stages":["setup_complete_zero_bookings"],"lifecycle_anchor":"stage_entered_at","delay_minutes_v2":14400}',
      50
    ),
    (
      'at_risk_ask_problem',
      'At risk — ce s-a întâmplat',
      'Doar pentru saloane anterior active.',
      'account_inactive',
      0,
      'at_risk_ask_problem',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_prior_activity":true,"min_inactive_days":21,"cooldown_days":30,"lifecycle_v2":true,"required_stages":["at_risk"],"lifecycle_anchor":"stage_entered_at","delay_minutes_v2":4320}',
      50
    ),
    (
      'winback_last',
      'Win-back — ultimul mesaj',
      'Ultimul mesaj pentru at_risk / churned.',
      'account_inactive',
      0,
      'winback_last',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_prior_activity":true,"min_inactive_days":45,"cooldown_days":90,"lifecycle_v2":true,"required_stages":["at_risk","churned_or_dormant"],"lifecycle_anchor":"stage_entered_at","delay_minutes_v2":10080}',
      50
    ),
    (
      'trial_ending_unactivated',
      'Trial ending — zero programări',
      'Fără countdown agresiv. Confirmă Free și cere motivul.',
      'trial_last_day',
      0,
      'trial_ending_unactivated',
      '{"require_eligible":true,"require_trialing":true,"require_not_paid":true,"max_bookings":0,"lifecycle_v2":true,"required_stages":["trial_ending","signup_incomplete","setup_complete_zero_bookings"],"lifecycle_anchor":"signup"}',
      40
    ),
    (
      'value_summary_5_bookings',
      'Rezumat după 5 programări',
      'Milestone de valoare, nu tutorial.',
      'min_bookings',
      0,
      'value_summary_5_bookings',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"min_bookings":5,"lifecycle_v2":true,"required_stages":["building_habit","active","first_online_booking"],"lifecycle_anchor":"first_booking_at"}',
      40
    ),
    (
      'free_plan_limit_hint',
      'Limita Free — 80 programări',
      'Doar când utilizarea lunară e aproape de plafon.',
      'min_bookings',
      0,
      'free_plan_limit_hint',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_not_paid":true,"lifecycle_v2":true,"required_stages":["active","free_active","trial_ending","building_habit"],"required_next_best_action":"analyze_upgrade"}',
      40
    )
) AS seed(
  automation_key, name, description, trigger_type, delay_minutes,
  template_key, conditions, priority
)
JOIN public.marketing_email_templates template
  ON template.template_key = seed.template_key
ON CONFLICT (automation_key) DO NOTHING;

-- Retarget existing automations. is_active is never flipped to true.
UPDATE public.marketing_automations
SET
  priority = 30,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'required_stages', jsonb_build_array('signup_incomplete'),
    'lifecycle_anchor', 'signup',
    'delay_minutes_v2', 0
  ),
  description = 'Welcome imediat după signup, dacă e eligibil marketing.'
WHERE automation_key = 'welcome_after_signup';

UPDATE public.marketing_automations
SET
  priority = 20,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'require_onboarding_incomplete', true,
    'required_stages', jsonb_build_array('signup_incomplete'),
    'lifecycle_anchor', 'signup',
    'delay_minutes_v2', 2880,
    'required_next_best_action', 'complete_onboarding'
  ),
  description = 'Doar dacă setup-ul e incomplet sau blochează rezervările. v2: 2 zile.'
WHERE automation_key = 'check_schedule_services_after_signup';

UPDATE public.marketing_automations
SET
  priority = 30,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'required_stages', jsonb_build_array(
      'setup_complete_zero_bookings',
      'manual_booking_only'
    ),
    'max_online_bookings', 0,
    'lifecycle_anchor', 'stage_entered_at',
    'delay_minutes_v2', 4320,
    'required_next_best_action', 'share_booking_link'
  ),
  description = 'Distribuie linkul dacă există programări manuale, dar zero online. Se oprește la prima programare online.'
WHERE automation_key = 'share_booking_link_after_signup';

UPDATE public.marketing_automations
SET
  priority = 60,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_online_bookings', 1,
    'required_stages', jsonb_build_array(
      'first_online_booking', 'building_habit', 'active'
    ),
    'lifecycle_anchor', 'first_online_booking_at',
    'delay_minutes_v2', 1440
  ),
  description = 'Google visibility după prima programare online, nu după signup.'
WHERE automation_key = 'google_visibility_after_signup';

UPDATE public.marketing_automations
SET
  priority = 20,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'required_stages', jsonb_build_array('signup_incomplete'),
    'lifecycle_anchor', 'signup',
    'delay_minutes_v2', 2880
  ),
  description = 'Reminder onboarding incomplet. v2 îl ține pe fluxul de setup.'
WHERE automation_key = 'incomplete_onboarding_after_signup';

UPDATE public.marketing_automations
SET
  priority = 30,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'require_onboarding_complete', true,
    'max_bookings', 0,
    'required_stages', jsonb_build_array('setup_complete_zero_bookings'),
    'lifecycle_anchor', 'stage_entered_at',
    'delay_minutes_v2', 14400
  ),
  description = 'Flux comportamental: zero programări după setup. Nu se trimite dacă a apărut o programare.'
WHERE automation_key = 'no_first_booking';

UPDATE public.marketing_automations
SET
  priority = 60,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_bookings', 2,
    'require_google_calendar_disconnected', true,
    'required_stages', jsonb_build_array(
      'first_online_booking', 'building_habit', 'active', 'manual_booking_only'
    ),
    'lifecycle_anchor', 'first_booking_at',
    'delay_minutes_v2', 0,
    'required_next_best_action', 'connect_google_calendar'
  ),
  description = 'Google Calendar doar după 2–3 programări și dacă nu e conectat.'
WHERE automation_key = 'google_calendar_after_signup';

UPDATE public.marketing_automations
SET
  priority = 60,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_active_barbers', 2,
    'required_stages', jsonb_build_array('building_habit', 'active', 'manual_booking_only'),
    'lifecycle_anchor', 'stage_entered_at',
    'delay_minutes_v2', 1440,
    'required_next_best_action', 'invite_team'
  ),
  description = 'Invite team doar dacă salonul are indicii de mai mulți frizeri.'
WHERE automation_key = 'invite_team_after_signup';

UPDATE public.marketing_automations
SET
  priority = 50,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'require_prior_activity', true,
    'required_stages', jsonb_build_array('at_risk'),
    'lifecycle_anchor', 'last_activity_at',
    'delay_minutes_v2', 0
  ),
  description = 'Win-back doar pentru saloane anterior active, nu pentru setup fără programări.'
WHERE automation_key = 'inactive_account';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_completed_bookings', 10,
    'required_stages', jsonb_build_array('active', 'building_habit', 'subscribed'),
    'lifecycle_anchor', 'first_booking_at',
    'required_next_best_action', 'request_review'
  ),
  description = 'Review după minimum 10 programări finalizate.'
WHERE automation_key = 'review_after_10_bookings';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_bookings', 1,
    'required_stages', jsonb_build_array(
      'manual_booking_only', 'first_online_booking', 'building_habit', 'active', 'trial_ending'
    )
  ),
  description = 'Tips de trial doar pentru utilizatori deja activați (au programări).'
WHERE automation_key = 'trial_active_tips';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_bookings', 1,
    'required_stages', jsonb_build_array('trial_ending', 'building_habit', 'active', 'first_online_booking', 'manual_booking_only')
  ),
  description = 'Countdown 7 zile doar dacă există activitate. Zero programări folosește mesajul de neactivare.'
WHERE automation_key = 'trial_ending_7_days';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_bookings', 5,
    'required_stages', jsonb_build_array('trial_ending', 'active', 'building_habit')
  ),
  description = 'Countdown 3 zile consolidat: doar utilizatori cu utilizare reală.'
WHERE automation_key = 'trial_ending_3_days';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'min_bookings', 1,
    'required_stages', jsonb_build_array('trial_ending', 'active', 'building_habit', 'first_online_booking', 'manual_booking_only')
  ),
  description = 'Ultima zi de trial: un singur email clar, pentru conturi activate.'
WHERE automation_key = 'trial_last_day';

UPDATE public.marketing_automations
SET
  priority = 40,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'required_stages', jsonb_build_array('free_active', 'churned_or_dormant', 'setup_complete_zero_bookings', 'signup_incomplete')
  ),
  description = 'Confirmă trecerea pe Free (80 programări/lună), nu pierderea accesului.'
WHERE automation_key = 'trial_expired';

UPDATE public.marketing_automations
SET
  priority = 50,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', true,
    'require_prior_activity', true,
    'min_bookings', 1,
    'required_stages', jsonb_build_array('churned_or_dormant', 'at_risk', 'free_active')
  ),
  description = 'Win-back 7 zile doar pentru utilizatori anterior activi.'
WHERE automation_key = 'trial_expired_7_days';

UPDATE public.marketing_automations
SET
  priority = 10,
  conditions = conditions || jsonb_build_object(
    'lifecycle_v2', false
  ),
  description = 'Tranzacțional: abonament plătit activat. Exceptat de la frequency cap.'
WHERE automation_key = 'subscription_activated';

COMMIT;
