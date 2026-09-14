# Ștergere cont Frizeo

Procedură: **request → 7 zile grace → anulare posibilă → finalizare automată zilnică**.

Contul rămâne funcțional în cele 7 zile. Booking-ul public nu se blochează pentru o cerere `pending`.

## Ce NU facem

- Nu ștergem `tenants`.
- Nu ștergem `bookings` (nici ale userului care pleacă).
- Nu ștergem evenimente din Google Calendar-ul utilizatorului.
- Nu ștergem facturi fiscale / istoricul Stripe.
- Nu folosim `ON DELETE CASCADE` de la Auth către `barbers` (ar fi șters programările).

## Finalizare (ordine)

1. Email final pe `email_snapshot`
2. Revocare Google OAuth + ștergere token-uri Frizeo
3. Ștergere avatar (`barber-avatars/{barber_id}`)
4. Anonimizare `barbers` + `user_id = null` + `active = false`
5. Dacă userul e ultimul membru al salonului: `directory_listed = false` și anulare Stripe
6. Ștergere `tenant_users` / `user_active_tenant` doar pentru acest user
7. Contact marketing: unsubscribe + detach `user_id`
8. Ștergere `profiles`
9. **Ștergere Auth user (ultimul pas mutabil)**
10. `account_deletion_requests.status = completed` (rândul rămâne pentru audit)

## Staging

- `simulate_expiry` și cron-ul zilnic sunt pentru test.
- `simulate_expiry` răspunde 404 în production.
- Worker-ul de pe staging este oprit implicit (`STAGING_BACKGROUND_JOBS_ENABLED`). Folosește **Delete now** din admin pentru a rula aceeași procedură.

## Rollback migrație

1. Oprește cron `/api/cron/account-deletion` și acțiunea admin Delete now.
2. `DROP TABLE public.account_deletion_requests CASCADE;`
3. Nu reintroduce `barbers.user_id NOT NULL` / `ON DELETE CASCADE` cât timp există frizeri detașați (`user_id IS NULL`).
