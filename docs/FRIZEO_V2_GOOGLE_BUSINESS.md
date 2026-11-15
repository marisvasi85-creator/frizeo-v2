# Google Business Profile

Adaptorul este separat de Google Calendar și de Meta. Publicarea reală cere ambele porți: capability-ul `marketing.publish.google_business.live` pentru salon și `GOOGLE_BUSINESS_PUBLISH_LIVE=true`. Fără una dintre ele, ruta răspunde `live_off` și nu apelează Google.

Staging rămâne singurul mediu unde publicarea a fost exercitată. Codul acceptă și hosturile de producție, dar nu pornește singur nimic acolo.

## Lansare controlată în producție

1. Nu adăuga scope-ul `business.manage` în clientul OAuth folosit de Calendar.
2. Păstrează clientul Google Business separat. În Google Cloud, adaugă exact:
   `https://www.frizeo.ro/api/integrations/google-business/callback` și
   `https://frizeo.ro/api/integrations/google-business/callback`.
3. Aplică pe baza de producție migrațiile Google deja prezente în `supabase/migrations`, inclusiv `20261115095424_frizeo_v2_google_production_post.sql`. Nu le aplica din acest repository automat.
4. Setează în producție `GOOGLE_BUSINESS_CLIENT_ID` și `GOOGLE_BUSINESS_CLIENT_SECRET`, diferite de `GOOGLE_CLIENT_ID`, plus `INTEGRATION_TOKEN_ENCRYPTION_KEY` și `NEXT_PUBLIC_SUPABASE_URL` către proiectul de producție.
5. Setează `GOOGLE_BUSINESS_REDIRECT_URI=https://www.frizeo.ro/api/integrations/google-business/callback`.
6. Lasă `GOOGLE_BUSINESS_PUBLISH_LIVE` nesetat până când un singur salon de producție are capability-ul live activat.
7. Activează `marketing.publish.google_business` și apoi `marketing.publish.google_business.live` doar pentru acel salon.
8. Setează `GOOGLE_BUSINESS_PUBLISH_LIVE=true` și publică o singură dată. Dacă statusul rămâne `unknown`, nu reîncerca.
9. După verificare, dezactivează capability-ul live. Nu șterge postul din Google.
