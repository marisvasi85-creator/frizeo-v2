# Ghid beta — Frizeo

Aplicația este deschisă pentru înregistrare (`/signup`). Acest ghid listează ce trebuie configurat **în afara codului** ca prietenii tăi să testeze tot fluxul, inclusiv Google Calendar.

## Checklist rapid

| Pas | Unde | Status |
|-----|------|--------|
| Variabile Vercel setate | Vercel → Environment Variables | `.env.example` |
| Migrări Supabase rulate | Supabase → SQL Editor | `supabase/migrations/` |
| Planuri în DB (`free`, `pro`, `pro-plus`) | Supabase | `supabase/audit_db.sql` |
| Redirect URLs Supabase | Supabase → Auth → URL Configuration | mai jos |
| Test users Google OAuth | Google Cloud Console | mai jos |
| Redirect URI Google OAuth | Google Cloud Console | mai jos |

---

## 1. Înregistrare & login (testeri)

**În cod (deja configurat pe branch-ul beta):**

- Conturile noi sunt create cu **email confirmat automat** — nu e nevoie de link de confirmare.
- Trial **Pro+** la înregistrare: **60 zile** (configurabil cu `TRIAL_DAYS` în Vercel).
- Cookie-uri de sesiune corecte pe mobil.

**În Supabase Dashboard → Authentication → URL Configuration:**

| Câmp | Valoare |
|------|---------|
| Site URL | `https://www.frizeo.ro` |
| Redirect URLs | `https://www.frizeo.ro/**` |
| | `https://www.frizeo.ro/auth/callback` |
| | `https://www.frizeo.ro/reset-password` |

**Recomandare:** dezactivează **Confirm email** (Auth → Providers → Email) — codul confirmă oricum conturile, dar dezactivarea evită emailuri inutile.

---

## 2. Google Calendar (obligatoriu de configurat pentru testeri)

Cât timp aplicația OAuth este în modul **Testing** pe Google Cloud, **doar adresele Gmail din lista „Test users”** pot conecta calendarul.

### Pași în Google Cloud Console

1. Deschide [Google Cloud Console](https://console.cloud.google.com/) → proiectul **Frizeo**
2. Meniu stânga: **Google Auth Platform**
3. Tab **Audience** → **Test users** → **+ Add users** → adaugă Gmail-urile testerilor
4. Tab **Clients** → clientul **Frizeo Web** → **Authorized redirect URIs**:
   ```
   https://www.frizeo.ro/api/google/callback
   ```
5. Tab **Data access** → confirmă scope **Google Calendar API** (sensibil — necesită test users sau verificare)
6. Dacă testezi pe preview Vercel, adaugă și redirect URI:
   ```
   https://<branch>-<team>.vercel.app/api/google/callback
   ```
   și setează `NEXT_PUBLIC_APP_URL` la acel URL în environment-ul de preview.

### Lista de testeri din repo

Editează `config/google-test-users.txt` (câte un Gmail pe linie), apoi:

```bash
node scripts/print-google-test-users.mjs
```

Copiază adresele în Google Cloud Console.

**Tester cunoscut:** `sanrazvan8@gmail.com` (deja în listă).

### Limită mod Testing

Google permite maxim **100 de test users**. Pentru acces public fără listă, trebuie publicată aplicația în **Production** și completată **verificarea Google** pentru scope-ul Calendar.

---

## 3. Ce pot face testerii fără configurare extra

- Înregistrare la `/signup`
- Login la `/login` (inclusiv de pe telefon)
- Dashboard, servicii, program, programări
- Pagină publică de booking (link-ul din profil)
- Trial Pro+ (60 zile): SMS, limite mai mari, Google Calendar după pasul 2

## 4. Opțional pentru experiență completă

| Serviciu | Variabile | Efect |
|----------|-----------|-------|
| Email | `EMAIL_*` | Confirmări, reminder-e |
| SMS | `SMSO_API_KEY` | SMS în trial |
| Stripe | `STRIPE_*` | Upgrade plan plătit |
| Cron | `CRON_SECRET` + Vercel Cron | Reminder-e automate, expirare trial |

---

## 5. Flux de test recomandat

1. Testerul creează cont la `https://www.frizeo.ro/signup`
2. Completează profilul în **Admin → Profil**
3. **Conectează Google Calendar** (Gmail-ul trebuie să fie în Test users)
4. Deschide linkul public de booking și face o programare test
5. Verifică programarea în dashboard și (dacă e conectat) în Google Calendar

---

## Suport

Probleme la testare: **info@frizeo.ro**
