import LegalPageLayout from "@/app/components/LegalPageLayout";
import { GOOGLE_POLICY_LINKS } from "@/lib/legal/googleCalendar";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Date Google Calendar",
  description:
    "Cum Frizeo folosește Google Calendar: scope-uri OAuth, prelucrare date, Limited Use, revocare acces.",
  path: "/google-calendar-data",
  keywords: [
    "Frizeo Google Calendar",
    "OAuth Google Calendar frizerie",
    "date Google Calendar România",
  ],
});

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function GoogleCalendarDataPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Utilizarea datelor Google Calendar">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Despre Frizeo</h2>
      <p>
        Frizeo (
        <ExtLink href={c.website}>{c.website}</ExtLink>) este operată de{" "}
        {c.name}, {c.address}.
      </p>
      <p>
        Frizeo este o platformă SaaS de programări online destinată în
        principal frizeriilor, barbershop-urilor și saloanelor din România,
        precum și clienților acestora.
      </p>
      <p>
        Interfața aplicației, suportul și documentația legală sunt în limba
        română, iar moneda utilizată este Leul Românesc (RON).
      </p>
      <p>
        Conectarea Google Calendar este complet opțională și este inițiată
        exclusiv de utilizator (frizer) din secțiunea Profil.
      </p>

      <h2>2. Scope-uri OAuth solicitate</h2>
      <p>
        Frizeo solicită doar permisiunile strict necesare pentru
        funcționalitatea de sincronizare Google Calendar.
      </p>

      <h3>Scope 1</h3>
      <p>
        <code>
          <ExtLink href={CALENDAR_SCOPE}>{CALENDAR_SCOPE}</ExtLink>
        </code>
      </p>
      <p>
        <strong>Motivul utilizării</strong>
      </p>
      <p>Acest scope este necesar pentru:</p>
      <ul>
        <li>
          crearea automată a evenimentelor în Google Calendar atunci când o
          programare este confirmată;
        </li>
        <li>
          actualizarea evenimentelor dacă programarea este modificată;
        </li>
        <li>
          ștergerea evenimentelor dacă programarea este anulată;
        </li>
        <li>
          citirea disponibilității calendarului (Free/Busy) pentru a ascunde
          intervalele deja ocupate și pentru a preveni programările
          suprapuse (double-booking).
        </li>
      </ul>
      <p>
        Nu există un scope mai restrâns care să permită simultan aceste
        funcționalități.
      </p>

      <h3>Scope 2</h3>
      <p>
        <code>
          <ExtLink href={EMAIL_SCOPE}>{EMAIL_SCOPE}</ExtLink>
        </code>
      </p>
      <p>
        <strong>Motivul utilizării</strong>
      </p>
      <p>
        Acest scope este utilizat exclusiv pentru identificarea și afișarea
        contului Google conectat în profilul frizerului.
      </p>
      <p>Nu este utilizat pentru marketing, profilare sau alte scopuri.</p>

      <h2>3. Ce date Google accesăm</h2>
      <p>
        Frizeo accesează exclusiv datele necesare funcționării sincronizării
        Google Calendar.
      </p>

      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm text-gray-800">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 pr-4 font-semibold">Date Google accesate</th>
              <th className="py-2 font-semibold">Scop</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4">Adresa Gmail conectată</td>
              <td className="py-2">
                Afișarea contului Google conectat în profil
              </td>
            </tr>
            <tr className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4">Evenimente Calendar</td>
              <td className="py-2">
                Crearea, actualizarea și ștergerea programărilor
              </td>
            </tr>
            <tr className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4">Ora de început a evenimentului</td>
              <td className="py-2">Sincronizarea programărilor</td>
            </tr>
            <tr className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4">Ora de sfârșit a evenimentului</td>
              <td className="py-2">Sincronizarea programărilor</td>
            </tr>
            <tr className="border-b border-gray-100 align-top">
              <td className="py-2 pr-4">
                Disponibilitatea calendarului (Free/Busy)
              </td>
              <td className="py-2">Prevenirea programărilor suprapuse</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        Frizeo nu accesează alte servicii Google și nu solicită permisiuni
        suplimentare.
      </p>

      <h2>4. Cum folosim datele Google Calendar</h2>
      <p>
        Datele Google Calendar sunt utilizate exclusiv pentru
        funcționalitățile solicitate de utilizator.
      </p>
      <p>Acestea includ:</p>
      <ul>
        <li>
          crearea automată a unui eveniment în Google Calendar atunci când o
          programare este confirmată;
        </li>
        <li>
          actualizarea evenimentului dacă programarea este modificată;
        </li>
        <li>
          ștergerea evenimentului dacă programarea este anulată;
        </li>
        <li>
          verificarea intervalelor ocupate (Free/Busy) pentru a împiedica
          rezervarea unui interval deja ocupat în calendarul Google;
        </li>
        <li>
          afișarea adresei Gmail conectate în profilul utilizatorului.
        </li>
      </ul>
      <p>
        Datele Google sunt utilizate numai pentru furnizarea
        funcționalităților vizibile utilizatorului.
      </p>

      <h2>5. Ce NU facem cu datele Google</h2>
      <p>Frizeo:</p>
      <ul>
        <li>nu vinde datele Google ale utilizatorilor;</li>
        <li>nu transferă date Google către brokeri de date;</li>
        <li>nu partajează date Google cu agenții de publicitate;</li>
        <li>nu utilizează date Google pentru profilare;</li>
        <li>
          nu utilizează date Google pentru publicitate personalizată;
        </li>
        <li>
          nu accesează Gmail, Google Drive, Google Photos sau alte servicii
          Google;
        </li>
        <li>
          nu utilizează datele Google în alte scopuri decât sincronizarea
          calendarului.
        </li>
      </ul>
      <p>
        Frizeo accesează numai cantitatea minimă de date necesară pentru
        funcționalitățile activate de utilizator.
      </p>

      <h2>6. AI și Machine Learning</h2>
      <p>
        Frizeo nu utilizează datele Google Calendar pentru dezvoltarea,
        îmbunătățirea sau antrenarea modelelor de Inteligență Artificială
        (AI) sau Machine Learning (ML).
      </p>
      <p>Datele Google Calendar:</p>
      <ul>
        <li>nu sunt utilizate pentru antrenarea modelelor AI;</li>
        <li>
          nu sunt transmise către servicii AI terțe pentru antrenarea
          modelelor;
        </li>
        <li>
          nu sunt utilizate pentru dezvoltarea unor modele generale de
          inteligență artificială.
        </li>
      </ul>
      <p>
        Orice funcționalitate AI implementată în viitor va respecta{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.userDataPolicy}>
          Google API Services User Data Policy
        </ExtLink>{" "}
        și cerințele{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.limitedUse}>Limited Use</ExtLink>.
      </p>

      <h2>7. Limited Use</h2>
      <p>
        Frizeo respectă în totalitate{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.userDataPolicy}>
          Google API Services User Data Policy
        </ExtLink>
        .
      </p>
      <p>
        The use of information received from Google APIs will adhere to the{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.userDataPolicy}>
          Google API Services User Data Policy
        </ExtLink>
        , including the{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.limitedUse}>
          Limited Use
        </ExtLink>{" "}
        requirements.
      </p>
      <p>
        Datele Google sunt utilizate exclusiv pentru furnizarea
        funcționalităților solicitate de utilizator și nu sunt folosite în
        alte scopuri.
      </p>

      <h2>8. Stocare și securitate</h2>
      <p>
        Token-urile OAuth (Access Token și Refresh Token) și adresa Gmail
        conectată sunt stocate securizat în baza de date Frizeo și sunt
        asociate exclusiv contului utilizatorului care a autorizat
        conexiunea.
      </p>
      <p>Protecția datelor include:</p>
      <ul>
        <li>conexiuni criptate prin HTTPS;</li>
        <li>comunicații criptate cu Google Calendar API;</li>
        <li>
          acces la token-uri permis doar infrastructurii backend autorizate;
        </li>
        <li>
          acces restricționat exclusiv serviciilor necesare funcționării
          aplicației.
        </li>
      </ul>

      <h2>9. Păstrarea și ștergerea datelor</h2>
      <p>
        Datele Google sunt păstrate doar atât timp cât este necesar pentru
        furnizarea funcționalității de sincronizare Calendar.
      </p>
      <p>Token-urile OAuth sunt șterse definitiv atunci când:</p>
      <ul>
        <li>
          utilizatorul deconectează Google Calendar din Frizeo;
        </li>
        <li>
          utilizatorul revocă accesul aplicației din contul Google;
        </li>
        <li>utilizatorul își șterge contul Frizeo.</li>
      </ul>

      <h2>10. Revocarea accesului</h2>
      <p>
        Utilizatorii pot deconecta Google Calendar în orice moment din:
      </p>
      <p>
        <strong>Profil → Deconectează Google Calendar</strong>
      </p>
      <p>
        De asemenea, accesul poate fi revocat direct din contul Google:
      </p>
      <p>
        <ExtLink href={GOOGLE_POLICY_LINKS.revokeAccess}>
          {GOOGLE_POLICY_LINKS.revokeAccess}
        </ExtLink>
      </p>
      <p>
        Aplicația va apărea cu numele <strong>Frizeo</strong>.
      </p>

      <h2>11. Contact</h2>
      <p>Pentru întrebări privind utilizarea datelor Google:</p>
      <p>
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>

      <hr className="my-10 border-gray-200" />

      <h2>English Summary (for Google OAuth Verification)</h2>
      <p>
        Frizeo is an online appointment scheduling SaaS operated by{" "}
        {c.name} in Romania. It is designed primarily for barbershops,
        barber salons and hair salons in Romania.
      </p>
      <p>
        Google Calendar integration is completely optional and is initiated
        only by the barber.
      </p>

      <h3>Requested OAuth Scopes</h3>
      <p>
        <code>
          <ExtLink href={CALENDAR_SCOPE}>{CALENDAR_SCOPE}</ExtLink>
        </code>
      </p>
      <p>Required to:</p>
      <ul>
        <li>create Google Calendar events for confirmed bookings;</li>
        <li>update events when bookings are rescheduled;</li>
        <li>delete events when bookings are cancelled;</li>
        <li>
          read Free/Busy availability to prevent double-booking.
        </li>
      </ul>
      <p>
        No narrower scope can provide all of these user-facing features.
      </p>
      <p>
        <code>
          <ExtLink href={EMAIL_SCOPE}>{EMAIL_SCOPE}</ExtLink>
        </code>
      </p>
      <p>
        Used only to identify and display the connected Google account on
        the barber profile.
      </p>

      <h3>Google User Data</h3>
      <p>
        Frizeo accesses only the minimum Google Calendar data required to
        provide the requested synchronization features.
      </p>
      <p>Google user data is:</p>
      <ul>
        <li>never sold;</li>
        <li>never shared with advertisers;</li>
        <li>never transferred to data brokers;</li>
        <li>never used for advertising or profiling;</li>
        <li>
          never used to train Artificial Intelligence (AI) or Machine
          Learning (ML) models;
        </li>
        <li>
          never transferred to third-party AI providers for AI or ML
          training.
        </li>
      </ul>
      <p>
        OAuth tokens are securely stored and deleted when the user
        disconnects Google Calendar or deletes their Frizeo account.
      </p>
      <p>
        The use of information received from Google APIs will adhere to the{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.userDataPolicy}>
          Google API Services User Data Policy
        </ExtLink>
        , including the{" "}
        <ExtLink href={GOOGLE_POLICY_LINKS.limitedUse}>
          Limited Use
        </ExtLink>{" "}
        requirements.
      </p>
    </LegalPageLayout>
  );
}
