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

## Scope justification (copy-paste EN)

### `https://www.googleapis.com/auth/calendar`

```
Frizeo is a barbershop appointment scheduling SaaS operated from Romania,
primarily for barbershops and salons in Romania (Romanian UI, RON pricing,
Europe/Bucharest timezone). We use the Google Calendar scope only after the
barber explicitly connects Google Calendar from their Profile.

We use this scope to: (1) create a calendar event when a client booking is
confirmed, (2) delete or update the event when a booking is cancelled or
rescheduled, and (3) read free/busy information to hide time slots already
occupied in the barber's Google Calendar on the public booking page.

A narrower scope such as calendar.events alone would not allow reading busy
times from external calendar entries, which is required to prevent
double-bookings. We do not sell Google user data or use Calendar data for
advertising. See https://www.frizeo.ro/google-calendar-data
```

### `https://www.googleapis.com/auth/userinfo.email`

```
We use this scope to display which Google account is connected on the
barber's profile page and to store the linked google_email for account
management. No other Google profile data is requested.
```

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
