# Google Calendar — de la beta la producție

## Răspuns scurt

| Ce | Trebuie configurat per frizer? |
|----|-------------------------------|
| **Cont Frizeo** (signup, login, dashboard, booking) | **Nu** — oricine se înregistrează liber |
| **Google Calendar** (sync opțional din Profil) | **Da, în beta** (Test users) · **Nu, în producție** (după verificare Google) |

**Nu trebuie să adaugi manual fiecare frizer** pentru ca aplicația să funcționeze.  
Limitarea există **doar** la conectarea Google Calendar, cât timp aplicația OAuth e în modul **Testing**.

---

## De ce apare „Acces blocat”

Google tratează scope-ul `calendar` ca **sensibil**. Cât timp aplicația e în **Testing**:

- maxim **100** adrese Gmail în lista „Test users”
- orice alt cont Google primește **403 access_denied**

Înregistrarea la Frizeo, programările, SMS/email etc. **nu depind** de această listă.

---

## Varianta beta (acum) — pentru prieteni / testeri

1. Google Cloud → **OAuth consent screen** → **Test users**
2. Adaugi Gmail-ul fiecărui tester care vrea **Google Calendar**
3. Frizerul: **Profil → Conectează Google Calendar**

**Când are sens:** 5–20 testeri, perioadă scurtă de validare.

**Dezavantaj:** manual, limită 100, nu scalează.

---

## Varianta producție — orice frizer, fără listă manuală

### Pas 1: Pregătire în Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → proiectul **Frizeo**
2. **Google Auth Platform** → tab **Branding**
3. Completează:
   - **App name:** Frizeo
   - **User support email:** info@frizeo.ro
   - **App logo** (logo Frizeo)
   - **Application home page:** `https://www.frizeo.ro`
   - **Privacy policy:** `https://www.frizeo.ro/privacy`
   - **Terms of service:** `https://www.frizeo.ro/terms`
4. **Scopes:** păstrează doar ce folosești (minim necesar):
   - `.../auth/calendar` — sincronizare programări
   - `.../auth/userinfo.email` — afișare email conectat
5. **Authorized domains:** `frizeo.ro`
6. **Credentials → OAuth client:** redirect URI producție:
   ```
   https://www.frizeo.ro/api/google/callback
   ```

### Pas 2: Verificare Google (obligatoriu pentru Calendar în Production)

1. În **Google Auth Platform** → tab **Verification centre** → **Publish App**
2. Google deschide cererea de **verification** pentru scope-uri sensibile
3. Pregătește:
   - **Video demo** (2–5 min): login Frizeo → Profil → Conectează Google Calendar → programare → eveniment în Calendar
   - **Explicație scop:** „Aplicație de programări pentru frizerii; Calendar sync pentru a bloca sloturile ocupate și a crea evenimente la confirmare”
   - **Link privacy policy** live
4. Trimite cererea și răspunde la emailurile Google (1–4 săptămâni tipic)

După aprobare: **orice frizer** cu cont Google poate conecta Calendarul fără să îl adaugi tu.

### Pas 3: Verifică producția Frizeo

| Loc | Setare |
|-----|--------|
| Vercel | `NEXT_PUBLIC_APP_URL=https://www.frizeo.ro` |
| Vercel | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Supabase Auth | Site URL + redirect URLs pentru `www.frizeo.ro` |
| PR #4 merged | Login mobil, signup instant, cookie-uri |

---

## Ce poate face un frizer fără Google Calendar

Chiar înainte de verificare Google, fiecare frizer poate folosi **integral** Frizeo, minus sync-ul Calendar:

- cont, profil, servicii, program săptămânal
- programări în dashboard
- pagină publică de booking
- notificări email/SMS (dacă ai configurat SMTP/SMSO)
- trial / abonament

Google Calendar e **opțional** — îmbunătățește fluxul (sloturi ocupate din Calendar, evenimente automate), dar nu blochează restul.

---

## Strategie recomandată

```
Acum (beta)          →  Test users pentru testeri apropiați (max 100)
În paralel           →  Pregătești video + documentație pentru Google
După verificare      →  Publish App → orice frizer conectează Calendar singur
```

### Timeline orientativ

| Etapă | Durată |
|-------|--------|
| Adăugare test users | minute |
| Pregătire materiale verificare | 1–2 zile |
| Review Google | 1–4 săptămâni |
| Producție completă Calendar | după aprobare |

---

## Întrebări frecvente

**Pot să las aplicația în Testing pentru totdeauna?**  
Nu pentru scale — max 100 utilizatori Calendar, administrare manuală.

**Pot folosi doar scope `email` fără verificare?**  
Fără `calendar` nu poți citi/scrie evenimente; sync-ul nu ar funcționa.

**Frizerul folosește Outlook, nu Google?**  
În cod există doar Google Calendar; Outlook ar necesita integrare separată (Microsoft Graph).

**Trebuie verificare și pentru login cu Google?**  
Nu — Frizeo folosește email/parolă (Supabase). OAuth Google e doar pentru Calendar.

---

## Checklist producție completă

- [ ] PR #4 merged + deploy `www.frizeo.ro`
- [ ] Supabase: URL-uri auth, confirm email off
- [ ] Vercel: toate env vars din `.env.example`
- [ ] Google: Calendar API enabled
- [ ] Google: OAuth app **Published** + **verified** pentru `calendar`
- [ ] Email SMTP + SMSO (opțional dar recomandat)
- [ ] `CRON_SECRET` + cron-uri active
- [ ] Stripe live keys (când lansezi plăți reale)

Ghid tehnic detaliat: [SETUP_COMPLET.md](./SETUP_COMPLET.md)
