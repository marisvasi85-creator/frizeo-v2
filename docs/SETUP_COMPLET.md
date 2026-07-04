# Setup 100% — Frizeo funcțional complet

Ghid pentru ca **sanrazvan8@gmail.com** (și alți testeri) să folosească aplicația la capacitate maximă.

> **Important:** `sanrazvan8@gmail.com` este deja în `config/google-test-users.txt` (repo).  
> Singurul pas pe care **nu** îl poate face codul este adăugarea în **Google Cloud Console** — vezi secțiunea 2.

---

## Ordinea recomandată

| # | Pas | Timp | Cine |
|---|-----|------|------|
| 1 | Merge & deploy PR #4 | 5 min | Tu |
| 2 | Google: test user + Calendar API | 3 min | Tu |
| 3 | Vercel: variabile de mediu | 10 min | Tu |
| 4 | Supabase: URL-uri auth | 2 min | Tu |
| 5 | Vercel: `CRON_SECRET` + redeploy | 2 min | Tu |
| 6 | Test end-to-end cu Razvan | 15 min | Tester |

---

## 1. Deploy codul beta (obligatoriu)

1. **Merge** PR: https://github.com/marisvasi85-creator/frizeo-v2/pull/4  
2. Așteaptă deploy Vercel pe producție (`www.frizeo.ro`)  
3. Verifică: `https://www.frizeo.ro/login` se încarcă

Fără acest PR, login-ul pe mobil și signup-ul instant pot să nu funcționeze corect.

---

## 2. Google Calendar — pentru sanrazvan8@gmail.com

### 2a. Activează API-ul Calendar

1. [Google Cloud Console](https://console.cloud.google.com/) → proiectul Frizeo  
2. **APIs & Services** → **Library**  
3. Caută **Google Calendar API** → **Enable**

### 2b. Adaugă test user (fix pentru „Acces blocat”)

1. **APIs & Services** → **OAuth consent screen**  
2. Verifică **Publishing status**: *Testing* e OK pentru beta  
3. Scroll la **Test users** → **+ Add users**  
4. Adaugă exact: **`sanrazvan8@gmail.com`**  
5. **Save**

### 2c. Redirect URI OAuth

1. **APIs & Services** → **Credentials**  
2. Deschide clientul **OAuth 2.0 Client ID** (tip Web application)  
3. La **Authorized redirect URIs**, adaugă dacă lipsește:
   ```
   https://www.frizeo.ro/api/google/callback
   ```
4. **Save**

### 2d. Verificare Vercel

În Vercel → Environment Variables (Production):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://www.frizeo.ro
```

După ce adaugi test user-ul, Razvan merge la **Profil → Conectează Google Calendar** și ar trebui să meargă.

---

## 3. Vercel — variabile pentru 100%

### Minim (app + auth + calendar)

| Variabilă | Obligatoriu |
|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Da |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Da |
| `SUPABASE_SERVICE_ROLE_KEY` | Da |
| `NEXT_PUBLIC_APP_URL` | `https://www.frizeo.ro` |
| `GOOGLE_CLIENT_ID` | Da (Calendar) |
| `GOOGLE_CLIENT_SECRET` | Da (Calendar) |
| `TRIAL_DAYS` | `60` (recomandat beta) |

### Notificări email (confirmări, reminder-e)

| Variabilă | Exemplu |
|-----------|---------|
| `EMAIL_HOST` | `mail.frizeo.ro` sau SMTP provider |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | |
| `EMAIL_PASS` | |
| `EMAIL_FROM` | `Frizeo <noreply@frizeo.ro>` |

Fără email: programările merg, dar clienții nu primesc confirmare pe email.

### SMS (inclus în trial Pro+)

| Variabilă | Notă |
|-----------|------|
| `SMSO_API_KEY` | Cont [SMSO](https://www.smso.ro/) sau provider configurat |

Fără SMS: restul funcționează; doar SMS-urile lipsesc.

### Cron (reminder-e automate, curățare)

| Variabilă | Notă |
|-----------|------|
| `CRON_SECRET` | String random 32+ caractere |

După setare, redeploy. `vercel.json` din repo programează:

- `/api/cron/reminder` — la 15 min (reminder 2h înainte)
- `/api/cron/cleanup` — la fiecare oră
- `/api/cron/trial-cleanup` — zilnic 03:00 UTC

Vercel trimite automat `Authorization: Bearer {CRON_SECRET}`.

### Stripe (upgrade plan plătit — opțional la beta)

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO
STRIPE_PRICE_PRO_PLUS
```

---

## 4. Supabase

**Authentication → URL Configuration:**

| Câmp | Valoare |
|------|---------|
| Site URL | `https://www.frizeo.ro` |
| Redirect URLs | `https://www.frizeo.ro/**` |

**Authentication → Providers → Email:**

- Dezactivează **Confirm email** (codul confirmă automat la signup)

**SQL:** rulează migrările din `supabase/migrations/` dacă nu sunt deja aplicate.

---

## 5. Test complet — sanrazvan8@gmail.com

### A. Cont Frizeo

1. `https://www.frizeo.ro/signup` (sau login dacă are cont)  
2. Completează nume, telefon, parolă  
3. Ajunge în **Dashboard** fără email de confirmare

### B. Google Calendar

1. **Admin → Profil**  
2. **Conectează Google Calendar**  
3. Alege contul **sanrazvan8@gmail.com**  
4. Acceptă permisiunile → mesaj verde „Calendar conectat”

### C. Programări

1. Setează servicii + program în admin  
2. Deschide linkul public de booking (din profil)  
3. Fă o programare test cu alt email/telefon  
4. Verifică: apare în dashboard + (dacă email configurat) primești confirmare  
5. Verifică: apare în Google Calendar (dacă B a reușit)

### D. Mobil

1. Login de pe telefon (Safari/Chrome)  
2. Repetă B dacă e cazul

---

## Ce funcționează fără configurare extra

| Funcție | Fără email/SMS/cron |
|---------|---------------------|
| Signup / login / mobil | Da (după PR #4) |
| Dashboard, servicii, program | Da |
| Booking public | Da |
| Google Calendar sync | Da (după pasul 2) |
| Trial Pro+ 60 zile | Da |
| Email confirmare client | Nu |
| SMS reminder | Nu |
| Reminder automat 2h | Nu (fără cron) |

---

## Pentru acces public (fără listă test users)

Când vrei ca **orice** frizer să conecteze Google fără să îi adaugi manual:

1. Google Cloud → OAuth consent screen → **Publish app**  
2. Completează **verificarea Google** pentru scope `calendar`  
3. Procesul poate dura 1–4 săptămâni

Până atunci, adaugă fiecare Gmail în **Test users** (max 100).

**Producție fără listă manuală:** vezi [GOOGLE_OAUTH_PRODUCTION.md](./GOOGLE_OAUTH_PRODUCTION.md)

---

## Adăugare testeri noi

1. Editează `config/google-test-users.txt` (câte un Gmail pe linie)  
2. Rulează `npm run beta:google-users`  
3. Copiază lista în Google Cloud → Test users  
4. Commit în repo (opțional, pentru evidență)

---

**Suport:** info@frizeo.ro
