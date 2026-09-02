-- Clickable account / booking URLs in activation automation templates.

BEGIN;

UPDATE public.marketing_email_templates
SET body_text = E'Salut, {{first_name}}!\n\nContul tău Frizeo este creat, dar pagina de programări nu e încă gata de clienți.\n\nÎn cont poți face totul de aici:\n{{dashboard_url}}\n\n1. Configurează serviciile (nume, durată, preț opțional):\n{{services_url}}\n\n2. Configurează programul de lucru:\n{{schedule_url}}\n\n3. Distribuie linkul de booking clienților tăi:\n{{booking_link}}\n\nDupă acești pași, clienții se pot programa singuri, fără să te mai sune.'
WHERE template_key = 'incomplete_onboarding'
  AND is_system_template = true;

UPDATE public.marketing_email_templates
SET body_text = E'Salut, {{first_name}}!\n\nNu te-am mai văzut de curând în Frizeo și am vrut să verificăm dacă totul e în regulă.\n\nIntră în contul tău aici:\n{{dashboard_url}}\n\nDacă ai rămas blocat la configurare, la linkul de programări sau la altceva, răspunde la acest email — te ajutăm.\n\nServicii: {{services_url}}\nProgram: {{schedule_url}}'
WHERE template_key = 'inactive_account'
  AND is_system_template = true;

UPDATE public.marketing_email_templates
SET body_text = E'Salut, {{first_name}}!\n\nFrizeo e configurat, dar încă nu a venit prima programare online.\n\nCel mai rapid drum: pune linkul tău de booking unde vorbesc deja clienții cu tine.\n\n• Instagram — în bio și în story\n• Facebook — în descrierea paginii\n• WhatsApp — în status sau trimis direct clienților\n• Google Business Profile — în site / linkuri\n\nLinkul tău de programări:\n{{booking_link}}\n\nÎl copiezi și din Dashboard:\n{{dashboard_url}}\n\nClienții aleg singuri ora. Tu vezi programarea în Frizeo.'
WHERE template_key = 'no_first_booking'
  AND is_system_template = true;

UPDATE public.marketing_email_templates
SET body_text = E'Salut, {{first_name}}!\n\nDacă lucrezi și cu Google Calendar, conectează-l din Profil frizer:\n{{profile_url}}\n\nBeneficii:\n• fără programări duble — orele ocupate din Google nu mai apar libere în Frizeo\n• sincronizare automată — programările noi din Frizeo apar în Google\n• actualizare instant — mutările și anulările se văd în ambele calendare\n\nDurează un minut. După conectare, programările din Frizeo și din Google rămân aliniate.'
WHERE template_key = 'connect_google_calendar'
  AND is_system_template = true;

UPDATE public.marketing_email_templates
SET body_text = E'Salut, {{first_name}}!\n\nPe Pro+ poți invita colegii în Frizeo, din pagina Frizeri:\n{{barbers_url}}\n\nFiecare frizer:\n• își administrează programul și zilele libere\n• își setează serviciile\n• are un link propriu de booking, pe lângă pagina salonului\n\nTu vezi tot salonul. Ei își văd programul.\n\nInvitațiile se trimit cu nume și email, tot din Frizeri.'
WHERE template_key = 'invite_team'
  AND is_system_template = true;

COMMIT;
