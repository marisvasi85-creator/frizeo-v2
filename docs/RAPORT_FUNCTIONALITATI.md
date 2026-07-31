# Raport funcționalități — Frizeo

**Produs:** Frizeo (`frizeo.ro`) — SaaS de programări online pentru frizerii și saloane  
**Stack:** Next.js, Supabase, Stripe, Google Calendar, OpenAI/Gemini, SMSO (SMS), FGO (facturi)  
**Data raportului:** 26 iulie 2026  
**Sursă:** inventar din codebase (`app/`, `lib/`, `supabase/`, `docs/`)

---

## 1. Rezumat

Frizeo permite unui salon/frizer să:

1. își configureze serviciile și programul;
2. distribuie un link public de programări;
3. primească programări automate de la clienți;
4. gestioneze echipa, notificările, calendarul și abonamentul;
5. folosească AI pentru marketing și asistență operațională.

Poziționare publică: *„Programările se fac singure. Tu doar tunzi.”*

---

## 2. Planuri și limite

| Plan | Preț | Frizeri | Programări | SMS | Highlights |
|------|------|---------|------------|-----|------------|
| **Free** | 0 lei/lună | 1 | 80/lună | Nu | Link programări, calendar, servicii, email, program săptămânal |
| **Pro** | 79 lei/lună | 1 | Nelimitate | Reminder SMS | Google Calendar, zile speciale, email confirmare/anulare/reprogramare |
| **Pro+** | 199 lei/lună | până la 3 | Nelimitate | Reminder SMS | Echipă, invitații frizeri, vizibilitate programări salon |
| **Custom** | La cerere | Personalizat | Nelimitate | Extins (negociat) | Mai mulți frizeri/locații, suport dedicat |

**Trial:** 60 zile Pro+ la înregistrare (configurabil prin `TRIAL_DAYS`). După expirare, fără Stripe → Free.

**Limite Marketing AI (generări/zi):** Free 3 · Pro 20 · Pro+ / Trial 50 · Custom nelimitat.

---

## 3. Experiența publică (client)

### 3.1 Site marketing
- Landing page cu flux în 3 pași, video demo, trial 60 zile
- Pricing, contact, pagini legale (termeni, privacy, cookies, Google Calendar data)
- SEO: JSON-LD Organization / WebSite / SoftwareApplication, sitemap, robots

### 3.2 Director local de frizerii
- `/frizerii` — index pe orașe
- `/frizerii/[city]` — listă SEO pe oraș
- `/frizerii/harta` — hartă Leaflet/OpenStreetMap
- Filtre servicii: Fade, Barbă, Tuns, Copii, Femei, Spălat
- Opt-in salon prin `directory_listed`
- Intro SEO pe oraș (template sau AI, cu cache)

### 3.3 Pagina publică salon
- URL: `/booking/salon/{slug}`
- Logo, telefon, descriere, oraș, galerie, frizeri (avatar, bio, Instagram)
- Review summary + JSON-LD HairSalon (adresă, ore, rating, geo)
- Redirect permanent la schimbarea slug-ului

### 3.4 Booking public
- Link stabil UUID: `/booking/{barberId}`
- Link SEO: `/booking/salon/{tenantSlug}/{barberSlug}`
- Flux: serviciu → dată → slot → date client → hold (10 min) → confirmare
- Validări: program, pauze, concedii, holds, Google busy, lead time (default 2h), limită plan
- Prefill local: nume, telefon, email
- Confirmare: Google Calendar + download `.ics` + link review

### 3.5 Self-service client
- **Anulare** pe token (`/cancel/[token]`) — sincronizează Google, email/SMS
- **Reprogramare** pe token (`/reschedule/[token]`) — lead time, conflict check, Google sync
- **Review** pe token (`/review/[token]`) — rating 1–5, comentariu max 800 caractere, o dată per booking

### 3.6 Locație
- Adresă structurată (stradă, oraș, județ, CP, lat/lng)
- Link Google Maps / Waze / embed
- Frizerul poate folosi locația salonului sau una proprie

---

## 4. Panou admin (salon / frizer)

### 4.1 Roluri
- **Owner** — tot salonul + frizeri + salon + billing + Platform AI (doar creator)
- **Manager** — vizibilitate salon
- **Barber** — propriile programări, servicii, program, profil, notificări, Marketing AI, Assistant

### 4.2 Dashboard
- Salut, checklist „Primii pași”, link booking
- Status trial Pro+ (zile rămase)
- Metrici: programări azi, status zi, următoarea programare
- Acțiuni rapide: adaugă programare, programări, rapoarte, servicii, program

### 4.3 Programări
- Listă pe zi / săptămână / lună; upcoming vs past
- Owner: tot salonul + filtru frizer; barber: doar ale lui
- Creare manuală, editare (client, dată, slot, mențiuni), anulare
- Sync notificări + Google Calendar

### 4.4 Servicii
- CRUD + activare/dezactivare
- Durate: 15–120 min; preț opțional; sort order
- Inactive → ascunse în booking public

### 4.5 Program de lucru
- Program săptămânal (lucrează/liber, ore, pauză)
- Reguli lead time: 0–24h (recomandat 2h)
- Zile speciale: liber / program special / cu pauză
- Concedii pe interval (max 90 zile via Assistant)

### 4.6 Profil frizer
- Avatar, nume, telefon, bio
- Social: Instagram, Facebook, TikTok
- Link permanent booking
- Locație proprie sau a salonului
- Google Calendar: conectare / reconectare / deconectare / sync manual

### 4.7 Salon (owner)
- Link public, logo, galerie
- Nume, telefon, locație, descriere
- Opt-in director Frizeo
- Plan curent, frizeri vs limită, programări lună curentă

### 4.8 Echipă (owner)
- Listă frizeri, activare/dezactivare, ștergere
- Invitații email (nume, email, telefon)
- Accept invite: parolă → user + profil + barber + servicii/program implicite
- Limita de frizeri include invitațiile pending

### 4.9 Notificări
- Toggle email/SMS: confirmare, reminder, reprogramare, anulare
- Free: fără SMS; Trial/Pro/Pro+: SMS reminder; Custom: SMS extins

### 4.10 Rapoarte
- Confirmate / anulate / pending / total
- Clienți unici, venit estimat
- Breakdown pe frizer și pe serviciu; range presets

### 4.11 Abonament
- Status trial / active / past_due
- Checkout Stripe Pro/Pro+, Customer Portal, plată factură past_due
- Facturi fiscale FGO (PDF) după `invoice.paid`

---

## 5. Autentificare și onboarding

| Flux | Detalii |
|------|---------|
| **Signup** | Nume, email, telefon, parolă; termeni; email confirmat automat |
| **La signup se creează** | User, profil, tenant, owner, barber, trial Pro+, notificări, servicii implicite, program L–V 09–17 |
| **Login** | Email/parolă; setează tenant activ (owner → manager → membership → barber) |
| **Reset parolă** | Email + pagină setare parolă nouă |
| **Onboarding** | Checklist: servicii → program → notificări; redirect dacă lipsesc pașii |

---

## 6. Motor de programări

Sloturi calculate din:

- program săptămânal + override zi + concedii + pauze
- booking-uri confirmate + hold-uri pending
- Google Calendar FreeBusy
- durata serviciului + min booking notice
- tipuri slot: `free` / `booking` / `break` / `unavailable` (past, notice)

Hold temporar: **10 minute**. Creare booking prin RPC sigur (`create_booking_safe_v2`).

---

## 7. AI

### 7.1 Marketing AI
- Conținut social: post Instagram, Reel, Story, promoție serviciu, campanii sezoniere (Crăciun, Paște, Black Friday, Back to school)
- 3 variante / generare; tonuri: Relaxat, Premium, Street
- Context real: salon, frizer, servicii, prețuri, link booking
- Provideri: template (demo), Gemini, OpenAI
- Export: copy, WhatsApp, QR booking, card branduit 1080×1080 / Story 1080×1920
- Istoric generări

### 7.2 Frizeo Assistant (staging)
- Chat helper operațional în admin (activabil prin config)
- Tool-uri: briefing azi, programări, servicii populare, sloturi, creare/reprogramare/anulare booking, servicii, închidere/deschidere zi, concedii, status abonament
- Confirmare UI pentru acțiuni care modifică date
- Owner/manager: tot salonul; barber: doar propriile date

### 7.3 Platform AI (intern, creator-only)
- Overview platformă, health check, listă/detaliu saloane
- Note interne, billing watchlist, SMS usage
- Trial follow-up (email real), extend trial, set plan, delete tenant (cu confirmare slug)

---

## 8. Notificări și integrări

### 8.1 Email (SMTP / Nodemailer)
Confirmare client, notificare barber, reminder ~2h, reprogramare, anulare, invitație frizer, trial follow-up. Atașament `.ics` la confirmare/reprogramare.

### 8.2 SMS (SMSO)
Tipuri: booking, reminder, reschedule, cancel. Tracking în `sms_sends`. Reguli pe plan (vezi §2).

### 8.3 Cron (protejat `CRON_SECRET`)
| Job | Rol |
|-----|-----|
| `reminder` | Reminder ~2h + cleanup pending expired |
| `cleanup` | Șterge hold-uri expirate |
| `trial-cleanup` | Trial expirat fără Stripe → Free + dezactivează SMS |

### 8.4 Google Calendar
OAuth, refresh offline, calendar `primary`, create/delete/update events, FreeBusy pentru sloturi, sync/backfill booking-uri viitoare. În beta: doar test users Google (max 100 până la verification).

### 8.5 Stripe + FGO
Checkout, portal, webhook-uri subscription/invoice, sync plan în DB. La plată reușită → factură fiscală FGO (dacă profil facturare complet).

---

## 9. PWA / mobil

- Manifest dinamic: variantă **admin** (dark, start dashboard) și **booking** (white, start pe pagina de programare)
- ID-uri PWA separate ca instalările să nu se suprapună
- Prompt „Add to Home Screen” pe mobil, cu snooze
- Service worker register

---

## 10. Multi-tenancy

Entități cheie: `tenants`, `tenant_users` (roluri), `user_active_tenant`, `barbers`, servicii, schedule, overrides, bookings, subscriptions, plans, notification_settings, invitations, Google accounts, gallery, reviews, slug_redirects, marketing_ai_generations, sms_sends, fiscal invoices, platform notes, city SEO pages.

- Link permanent UUID + link SEO + slug redirects
- RBAC: owner/manager vs barber pe toate API-urile sensibile

---

## 11. SEO și compliance

- Pagini legale + date firmă (Electricsmart.Co SRL)
- Sitemap: home, pricing, contact, director, saloane publice, booking public
- Robots blochează: `/admin/`, `/api/`, login, cancel/reschedule/review tokens etc.
- JSON-LD: Organization, HairSalon, AggregateRating, Review, BreadcrumbList

---

## 12. Beta / operațional

Din `docs/BETA.md` și setup:

- Signup public activ; email confirmat automat; trial Pro+ 60 zile
- Google Calendar opțional, limitat la test users până la verification producție
- Opțional pentru experiență completă: Email SMTP, SMSO, Stripe, Cron extern
- Support: **info@frizeo.ro**

---

## 13. Hartă rapidă module ↔ UI

| Zonă | Rute principale |
|------|-----------------|
| Marketing | `/`, `/pricing`, `/contact`, `/frizerii`, `/frizerii/[city]` |
| Booking client | `/booking/salon/[slug]`, `/booking/[barberId]`, confirmed / cancel / reschedule / review |
| Admin | `/admin/dashboard`, `bookings`, `services`, `settings`, `profile`, `salon`, `barbers`, `notifications`, `reports`, `billing` |
| AI | `/admin/marketing-ai`, `/admin/assistant`, `/admin/platform-assistant` |
| Auth | `/signup`, `/login`, `/reset-password`, `/accept-invite/[token]` |

---

## 14. Concluzie

Frizeo acoperă end-to-end ciclul unui salon:

**achiziție client** (link + director + SEO) → **programare** (sloturi, hold, confirmare) → **operare** (admin, echipă, program, Google Calendar) → **retenție** (reminder email/SMS, reprogramare, review) → **monetizare** (planuri Stripe + facturi FGO) → **creștere** (Marketing AI + Assistant).

Raportul reflectă funcționalitățile implementate în cod la data de mai sus; unele module AI (Assistant, Platform AI) sunt marcate staging / interne și pot fi activate prin configurare.
