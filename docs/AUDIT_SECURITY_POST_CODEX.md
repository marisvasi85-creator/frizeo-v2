# Audit securitate post-Codex — Frizeo

**Data:** 26 iulie 2026  
**Branch auditată:** `origin/staging` (`e155a66` + `d227244` + `6e22252`)  
**Referință audit anterior:** Codex read-only (P0–P3)  
**Verificare live Supabase:** **neefectuată** — MCP Supabase cere autentificare în Cursor Desktop (indisponibilă în cloud agent). Concluziile de mai jos sunt pe **cod + migrări**; politicile efective din producție trebuie confirmate cu `supabase/audit_db.sql`.

---

## Verdict scurt

Codex a acoperit **majoritatea** findings-urilor din auditul anterior, pe `staging`. Fixurile sunt **bune pe intenție**, dar:

1. Migrarea `20260707_tenant_security_hardening.sql` **nu a fost verificată ca aplicată** pe DB live.
2. Rămân **politici RLS legacy overlap** pe `bookings` și `notification_settings` care pot **anula parțial** fixul P1 (RLS e OR între politici).
3. Fixurile **nu sunt pe `main`** — doar pe `staging`.

---

## Ce a rezolvat Codex (vs auditul anterior)

| # | Finding original | Status pe staging | Dovezi |
|---|------------------|-------------------|--------|
| **P0** | `tenant_users_insert_self` — self-join ca owner pe orice tenant | **Rezolvat în migrare** | Drop policy + `REVOKE INSERT/UPDATE/DELETE` pe `tenant_users` pentru anon/authenticated; provisioning rămâne pe `service_role` |
| **P0+** | Active tenant fără verificare membership | **Rezolvat** | RLS pe `user_active_tenant` + `EXISTS` pe `tenant_users`; `getActiveTenant` respinge tenant activ fără membership/barber |
| **P1** | Barber citește/update toate booking-urile | **Parțial** | `bookings_tenant_read/update` restrânse pe owner/manager sau `barber_id` propriu — **dar** rămân politici legacy (vezi Residual) |
| **P1** | Orice frizer modifică `notification_settings` | **Parțial** | `notification_settings_tenant_write` doar owner/manager — **dar** rămân `notification_settings_insert/update` fără rol |
| **P1** | Google OAuth fără `state` | **Rezolvat** | `crypto.randomUUID()` + cookie httpOnly; callback respinge mismatch |
| **P2** | Hold fără legătură serviciu↔frizer | **Rezolvat** | Hold filtrează `barber_id` + `tenant_id` + `active` |
| **P2** | Reschedule acceptă `new_end_time` de la client | **Rezolvat în API** | End time recalculat din durata serviciului; RPC încă acceptă `p_end` (defense-in-depth incompletă) |
| **P2** | Upload fără size/MIME + barber schimbă logo | **Parțial** | Max 5MB + allowlist MIME; logo/gallery doar owner/manager — **fără** verificare magic bytes |
| **P2** | Migrări incomplete / fără baseline | **Rezolvat în repo** | `20260620_baseline_schema.sql` + generator; include `create_booking_safe_v2` |
| **P2** | Signup non-atomic / fără anti-abuse | **Parțial** | Rate limit DB + rollback best-effort (delete tenant/user) — **nu** e o tranzacție unică |
| **P3** | Open redirect `//evil.com` | **Rezolvat** | Respinge `//` și `\` |
| **P3** | Security headers / env / middleware | **Parțial** | HSTS, nosniff, frame deny, referrer, permissions-policy; validare env la boot; `middleware` → `proxy` (Next 16). **Fără CSP**. Cron încă acceptă `?secret=` |

---

## Ce a adăugat Codex în plus (utile)

- `lib/security/rateLimit.ts` + RPC `consume_api_rate_limit` (service_role only)
- Rate limit pe: signup, login, reset-password, hold, reschedule, by-token, accept-invite
- `REVOKE` pe insert tenants din browser
- Extinderi în `audit_db.sql` pentru verificarea post-deploy
- Versionare `20260702_supabase_linter_fixes.sql` (revoke execute pe booking RPC pentru anon/authenticated)

---

## Residual / riscuri rămase (prioritate)

### R1 — P1 residual: politici booking legacy (important)

În baseline există politici **permissive** care **nu sunt drop-uite** de `20260707`:

- `"tenant read bookings"` — SELECT pe tot tenantul dacă `user_active_tenant` potrivește (fără rol / fără `barber_id`)
- Posibil și alte politici pe lângă `bookings_tenant_*`

În Postgres RLS, **orice politică care permite** = acces. Deci un frizer membru poate încă citi toate programările salonului **dacă** politica legacy e încă activă în DB.

**Acțiune:** migrare care `DROP POLICY` pe toate politicile booking non-necesare, apoi păstrează un set minim (owner/manager full, barber doar `barber_id` propriu). Rulează `audit_db.sql` secțiunea policies pe `bookings`.

### R2 — P1 residual: `notification_settings_insert` / `_update`

Baseline:

- insert/update dacă user e în `tenant_users` — **fără** `role IN ('owner','manager')`

Codex a restrâns doar `notification_settings_tenant_write`. Politicile vechi pot permite tot update-ul unui barber.

**Acțiune:** drop `notification_settings_insert` / `_update` (sau adaugă check pe rol).

### R3 — Upload: MIME client-controlled

`validateImageUpload` verifică `file.type` + size, nu magic bytes. Un client poate trimite `Content-Type: image/png` cu payload non-image.

**Severitate:** P2/P3. Remediare: sniff magic bytes / `file-type` + (ideal) resize/re-encode.

### R4 — RPC `create_booking_safe_v2` încă are încredere în `p_end`

API-ul recalculează durata (bine). RPC verifică că serviciul aparține frizerului, dar **nu** recalculează `p_end` din `duration`. Defense in depth incompletă.

### R5 — Migrarea trebuie aplicată pe Supabase

Codul pe staging ≠ DB live. Fără `20260707` aplicat:

- P0 rămâne deschis
- rate limit RPC lipsește → auth/booking returnează **503** (fail-closed)

### R6 — CSP lipsă; cron `?secret=` încă documentat

Headers bune, dar fără Content-Security-Policy. Preferă doar `Authorization: Bearer` pentru cron.

---

## Matrice „înainte → după”

```
P0 tenant_users self-insert     ████████ CRITICAL  →  ░░░░░░░░ FIXED (migrare)
P1 bookings cross-barber        ████████ HIGH      →  ████░░░░ PARTIAL (legacy OR)
P1 notification_settings write  ███████░ HIGH      →  ████░░░░ PARTIAL (legacy OR)
P1 Google OAuth state           ██████░░ HIGH      →  ░░░░░░░░ FIXED
P2 hold service scoping         █████░░░ MED       →  ░░░░░░░░ FIXED
P2 reschedule end_time          █████░░░ MED       →  ░░██████ API fixed / RPC weak
P2 uploads                      █████░░░ MED       →  ██░░░░░░ PARTIAL
P2 schema baseline              ████░░░░ MED       →  ░░░░░░░░ FIXED in repo
P2 signup abuse/atomicity       ████░░░░ MED       →  ██░░░░░░ PARTIAL
P3 open redirect                ███░░░░░ LOW       →  ░░░░░░░░ FIXED
P3 headers/proxy/env            ███░░░░░ LOW       →  █░░░░░░░ MOSTLY (no CSP)
```

---

## Ce trebuie confirmat pe Supabase live

Rulează în SQL Editor rezultatele din `supabase/audit_db.sql`, în special:

1. `tenant_users` — **0** politici INSERT/UPDATE/DELETE pentru authenticated/anon  
2. `bookings` — lista completă de policies; **nu** trebuie să existe `"tenant read bookings"` permisiv pe tot tenantul  
3. `notification_settings` — write doar owner/manager  
4. `consume_api_rate_limit` — execute doar `service_role`  
5. Există `api_rate_limits` + funcția rate-limit  

---

## Concluzie

Codex a făcut un **pass serios și corect pe P0, OAuth, hold/reschedule API, upload role-gating, baseline, rate limit, headers**.  

Nu aș marca încă „securitate multi-tenant închisă” din cauza:

1. **overlap RLS legacy** (R1/R2) — cel mai important follow-up;  
2. **aplicării migrării pe DB** — neverificată din acest mediu;  
3. lipsei merge pe `main` / producție.

**Recomandare:** aplică `20260707` pe staging DB → rulează `audit_db.sql` → drop politici legacy residual → abia apoi promovează pe producție.
