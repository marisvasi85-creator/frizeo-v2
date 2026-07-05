# Trimitere verificare Google OAuth — Frizeo

Folosește acest document când completezi **Verification centre** în Google Cloud Console.

Pagini publice relevante (verifică că se încarcă fără login):

- Home: https://www.frizeo.ro
- Privacy: https://www.frizeo.ro/privacy
- Terms: https://www.frizeo.ro/terms
- Google Calendar data: https://www.frizeo.ro/google-calendar-data

---

## Branding (Google Auth Platform → Branding)

| Câmp | Valoare |
|------|---------|
| App name | Frizeo |
| User support email | info@frizeo.ro |
| Home page | https://www.frizeo.ro |
| Privacy policy | https://www.frizeo.ro/privacy |
| Terms | https://www.frizeo.ro/terms |
| Authorized domains | frizeo.ro |

---

## Scope justification (copy-paste EN, max ~1000 chars each)

### `https://www.googleapis.com/auth/calendar`

```
Frizeo is a booking SaaS for barbershops in Romania. Google Calendar is optional; barbers connect it from Profile.

Uses: (1) create events when bookings are confirmed, (2) delete/update on cancel or reschedule, (3) read free/busy to hide occupied slots on the public booking page and prevent double-booking.

We do not sell Google data or use Calendar for ads. Narrower scopes cannot read external busy times. https://www.frizeo.ro/google-calendar-data
```

*(~480 caractere)*

### `https://www.googleapis.com/auth/userinfo.email`

```
Display the connected Google email on the barber profile and store it for account management. No other Google profile data is requested.
```

*(~130 caractere)*

---

## Video demo (tu îl faci)

Minimum de arătat (consent screen în **English**):

1. www.frizeo.ro — app name Frizeo visible
2. Login → Admin → Profil
3. Disclosure text before connect (optional sync, link to privacy)
4. Click Conectează Google Calendar
5. Full OAuth consent screen — scopes match Data access
6. Accept → connected message
7. Public booking → confirmed appointment
8. Event appears in Google Calendar

YouTube: **Unlisted**. Include Client ID visible in Google Cloud if possible.

---

## Pași submit

1. **Audience** → **Publish app** (Testing → Production)
2. **Verification centre** → **Prepare for verification**
3. Paste scope justifications above
4. Paste YouTube link
5. **Submit for verification**
6. Monitor **info@frizeo.ro** — răspunde în 24–48h la întrebări Google

---

## După aprobare

- Nu mai e nevoie de Test users pentru Calendar
- Actualizează Branding dacă Google cere schimbări minore
- Păstrează `/google-calendar-data` actualizat la orice schimbare de scope
