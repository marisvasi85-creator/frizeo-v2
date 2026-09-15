# Ștergere cont Frizeo

Procedură: **request → 7 zile grace → anulare posibilă → finalizare automată zilnică**.

Contul rămâne funcțional în cele 7 zile. Booking-ul public nu se blochează pentru o cerere `pending`.

## Decizii de produs

1. **Google Calendar** — la finalizare revocăm OAuth și ștergem tokenurile Frizeo. Nu ștergem evenimentele existente din Google Calendar (același comportament ca disconnect).
2. **Programări viitoare** — la finalizare, booking-urile viitoare active ale barberului (`confirmed` + `pending` neexpirat) sunt anulate în loc (`status=cancelled`), iar clienții sunt notificați prin email/SMS tranzacțional existent. Operația e idempotentă: un retry nu re-anulează și nu retrimite. Nu se face hard DELETE. Booking-urile altor barberi din tenant nu sunt atinse. Istoricul rămâne.
3. **Owner cu alți membri** — un tenant nu poate rămâne fără owner. Request-ul poate exista, dar finalizarea e blocată până owner-ul alege un membru eligibil și transferă ownership-ul atomic, server-side. Nu există auto-promote.
4. **Ultimul membru** — soft-close: tenant-ul rămâne în DB, istoricul de booking și facturile rămân, salonul nu mai e listat public, nu mai acceptă booking-uri noi, Stripe activ se oprește doar dacă nu mai rămân membri, barberul e anonimizat/inactiv. Nu `deleteTenant`.
5. **Billing / facturi** — KEEP ca *retained financial records*. Account deletion nu șterge facturi sau evidențe financiar-contabile. Retenția e un proces separat; aici nu e codat un termen juridic.

## `barbers.user_id` nullable

`auth.users` → `barbers.user_id` este `ON DELETE SET NULL` (nu CASCADE), ca Auth delete să nu șteargă barberul și booking-urile.

Constrângeri:
- INSERT în `barbers` cere `user_id` (trigger).
- `CHECK (user_id IS NOT NULL OR active = false)` — un barber anonimizat nu poate fi reactivat.
- Un barber cu `user_id = NULL` și `active = false` nu apare în booking public, nu generează sloturi, nu primește booking-uri noi, nu accesează dashboard-ul (nu mai are Auth), nu primește email/SMS de barber, nu rulează Google sync (tokenurile sunt șterse), nu apare ca barber activ în assistant.

## Ce NU facem

- Nu ștergem `tenants`.
- Nu ștergem `bookings` (le anulăm pe cele viitoare active ale barberului care pleacă).
- Nu ștergem evenimente din Google Calendar-ul utilizatorului.
- Nu ștergem facturi fiscale / istoricul Stripe.
- Nu folosim `ON DELETE CASCADE` de la Auth către `barbers`.
- Nu promovăm automat un membru ca owner.

## Finalizare (ordine)

1. Dacă userul e owner unic și tenant-ul mai are membri: **stop**, request rămâne `pending` (`ownership_transfer_required`).
2. Email final pe `email_snapshot`
3. Anulare booking-uri viitoare active + notificare clienți (fără ștergere evenimente Google)
4. Revocare Google OAuth + ștergere token-uri Frizeo
5. Ștergere avatar (`barber-avatars/{barber_id}`)
6. Anonimizare `barbers` + `user_id = null` + `active = false`
7. Dacă userul e ultimul membru al salonului: `directory_listed = false` și anulare Stripe
8. Ștergere `tenant_users` / `user_active_tenant` doar pentru acest user
9. Contact marketing: unsubscribe + detach `user_id`
10. Ștergere `profiles`
11. **Ștergere Auth user (ultimul pas mutabil)**
12. `account_deletion_requests.status = completed` (rândul rămâne pentru audit)

## Staging

- `staging.frizeo.ro` și `www.frizeo.ro` folosesc **aceeași bază Supabase** (`shsompeyazrvswnjmlmw`). Staging este un hostname/branch de QA, nu un proiect separat.
- Cookie-urile de auth rămân host-only pe `staging.frizeo.ro`, ca un login de test să nu suprascrie sesiunea de pe `www.frizeo.ro`.
- `simulate_expiry` și butonul **Finalizează acum (staging)** răspund 404 pe `www.frizeo.ro`. Pe staging, finalizarea imediată mută `scheduled_for` la acum cu `service_role`, apoi rulează același worker (`claim_account_deletion_batch` + `auth.admin.deleteUser`).
- Worker-ul de pe staging este oprit implicit (`STAGING_BACKGROUND_JOBS_ENABLED`). Cron-ul de producție de pe `www` rulează finalizările scadente.
- Contul de test izolat: `qa-deletion-a@frizeo.test`, salon `directory_listed = false`, singur owner. Finalizarea face soft-close doar pe acest salon; nu șterge tenants, bookings sau facturi.
- `barbers.user_id` este `ON DELETE SET NULL` înainte de orice Auth delete. Nu aplica `20260915120000_account_deletion_self_finalize.sql` pe baza comună (RPC-ul ștearge Auth ca user, nu ca service_role).

## Rollback migrație

1. Oprește cron `/api/cron/account-deletion` și acțiunea admin Delete now.
2. `DROP TABLE public.account_deletion_requests CASCADE;`
3. `DROP FUNCTION IF EXISTS public.transfer_tenant_ownership(uuid, uuid, text);`
4. Nu reintroduce `barbers.user_id NOT NULL` / `ON DELETE CASCADE` cât timp există frizeri detașați (`user_id IS NULL`).
