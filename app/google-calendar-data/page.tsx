import LegalPageLayout from "@/app/components/LegalPageLayout";
import {
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_CALENDAR_USAGE_EN,
  GOOGLE_CALENDAR_USAGE_RO,
  GOOGLE_POLICY_LINKS,
} from "@/lib/legal/googleCalendar";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Date Google Calendar",
  description:
    "Cum Frizeo folosește Google Calendar: scope-uri OAuth, prelucrare date, revocare acces. Serviciu destinat pieței din România.",
  path: "/google-calendar-data",
  keywords: [
    "Frizeo Google Calendar",
    "OAuth Google Calendar frizerie",
    "date Google Calendar România",
  ],
});

export default function GoogleCalendarDataPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Utilizarea datelor Google Calendar">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated} ·{" "}
        <a href="/privacy" className="underline">
          Politica de confidențialitate
        </a>
      </p>

      <h2>1. Despre Frizeo</h2>
      <p>
        <strong>Frizeo</strong> ({c.website}) este operată de{" "}
        <strong>{c.name}</strong>, {c.address}, România. Platforma este
        destinată în principal <strong>frizeriilor, barbershop-urilor și
        saloanelor din România</strong>, precum și clienților lor finali care se
        programează online. Interfața, suportul și documentele legale sunt în
        limba română; prețurile sunt exprimate în lei (RON).
      </p>
      <p>
        Conectarea Google Calendar este <strong>opțională</strong> și inițiată
        explicit de frizer din secțiunea Profil.
      </p>

      <h2>2. Scope-uri OAuth solicitate</h2>
      <p>
        La conectare, Frizeo solicită doar scope-urile strict necesare
        funcționalității de sincronizare calendar:
      </p>
      <ul>
        {GOOGLE_CALENDAR_SCOPES.map((scope) => (
          <li key={scope.id}>
            <code className="text-sm">{scope.id}</code>
            {scope.sensitive ? " (sensibil)" : ""} — {scope.label}
          </li>
        ))}
      </ul>

      <h2>3. Cum folosim datele Google Calendar</h2>
      <ul>
        {GOOGLE_CALENDAR_USAGE_RO.purposes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>4. Ce nu facem cu datele Google</h2>
      <ul>
        {GOOGLE_CALENDAR_USAGE_RO.notUsedFor.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Respectăm{" "}
        <a
          href={GOOGLE_POLICY_LINKS.userDataPolicy}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>{" "}
        și cerințele de{" "}
        <a
          href={GOOGLE_POLICY_LINKS.limitedUse}
          target="_blank"
          rel="noopener noreferrer"
        >
          Limited Use
        </a>
        .
      </p>

      <h2>5. Stocare și securitate</h2>
      <p>{GOOGLE_CALENDAR_USAGE_RO.storage}</p>
      <p>
        Comunicarea cu Google Calendar API se face prin conexiuni criptate
        (HTTPS). Accesul la token-uri în Frizeo este restricționat la
        infrastructura serverului.
      </p>

      <h2>6. Revocarea accesului</h2>
      <p>{GOOGLE_CALENDAR_USAGE_RO.revoke}</p>
      <p>
        Link direct:{" "}
        <a
          href={GOOGLE_POLICY_LINKS.revokeAccess}
          target="_blank"
          rel="noopener noreferrer"
        >
          myaccount.google.com/permissions
        </a>
      </p>

      <h2>7. Contact</h2>
      <p>
        Întrebări despre datele Google:{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>

      <hr className="my-10 border-gray-200" />

      <h2>English summary (for app review)</h2>
      <p className="text-sm text-gray-600">{GOOGLE_CALENDAR_USAGE_EN.appPurpose}</p>
      <p className="text-sm text-gray-600 mt-4">
        <strong>calendar scope:</strong>{" "}
        {GOOGLE_CALENDAR_USAGE_EN.scopeJustification.calendar}
      </p>
      <p className="text-sm text-gray-600 mt-2">
        <strong>userinfo.email scope:</strong>{" "}
        {GOOGLE_CALENDAR_USAGE_EN.scopeJustification.email}
      </p>
      <p className="text-sm text-gray-600 mt-2">
        <strong>Limited use:</strong> {GOOGLE_CALENDAR_USAGE_EN.limitedUse}
      </p>
    </LegalPageLayout>
  );
}
