/**
 * Google Calendar OAuth — scopes, URLs and disclosure text for legal pages
 * and Google OAuth verification.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  {
    id: "https://www.googleapis.com/auth/calendar",
    label: "Google Calendar (calendar)",
    sensitive: true,
  },
  {
    id: "https://www.googleapis.com/auth/userinfo.email",
    label: "Adresa de email Google (userinfo.email)",
    sensitive: false,
  },
] as const;

export const GOOGLE_POLICY_LINKS = {
  userDataPolicy:
    "https://developers.google.com/terms/api-services-user-data-policy",
  limitedUse:
    "https://developers.google.com/terms/api-services-user-data-policy#limited-use",
  revokeAccess: "https://myaccount.google.com/permissions",
  calendarApi: "https://developers.google.com/calendar/api/guides/overview",
} as const;

export const GOOGLE_CALENDAR_USAGE_RO = {
  title: "Utilizarea datelor Google Calendar în Frizeo",
  purposes: [
    "Crearea automată a unui eveniment în calendarul frizerului când o programare este confirmată.",
    "Ștergerea sau actualizarea evenimentului când programarea este anulată sau reprogramată.",
    "Citirea intervalelor ocupate (free/busy) pentru a ascunde sloturile deja blocate în calendarul Google al frizerului pe pagina publică de programări.",
    "Afișarea adresei Gmail conectate în profilul frizerului (scope userinfo.email).",
  ],
  notUsedFor: [
    "Nu vindem datele Google ale utilizatorilor.",
    "Nu folosim datele Calendar pentru publicitate sau profilare.",
    "Nu accesăm conținutul mesajelor sau al altor produse Google.",
    "Nu transferăm datele Google către brokeri de date.",
  ],
  storage:
    "Token-urile OAuth (access și refresh) și adresa Gmail conectată sunt stocate securizat în baza de date Frizeo, asociate contului frizerului. Sunt șterse când frizerul revocă accesul sau șterge contul.",
  revoke:
    "Poți deconecta Calendar din Profil → Deconectează Calendar, sau revoca accesul din contul Google: myaccount.google.com/permissions — aplicația „Frizeo”.",
} as const;

/** English summary for Google OAuth reviewers (public page). */
export const GOOGLE_CALENDAR_USAGE_EN = {
  appPurpose:
    "Frizeo is a barbershop appointment scheduling SaaS operated from Romania, primarily for barbershops and salons in Romania (Romanian UI, RON pricing, Europe/Bucharest timezone).",
  scopeJustification: {
    calendar:
      "We use https://www.googleapis.com/auth/calendar to create events for confirmed bookings, delete events on cancellation/reschedule, and read free/busy times so public booking slots reflect the barber's Google Calendar availability. Narrower scopes would not allow reading external busy times needed to prevent double-bookings.",
    email:
      "We use https://www.googleapis.com/auth/userinfo.email to display which Google account is linked on the barber profile.",
  },
  limitedUse:
    "Google user data is used only to provide user-facing calendar sync features. We do not sell Google user data or use it for advertising.",
} as const;
