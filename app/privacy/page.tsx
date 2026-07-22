import LegalPageLayout from "@/app/components/LegalPageLayout";
import { GOOGLE_POLICY_LINKS } from "@/lib/legal/googleCalendar";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Politica de confidențialitate",
  description:
    "Cum prelucrăm datele personale în Frizeo: conturi salon, programări, plăți Stripe, Google Calendar și drepturile tale GDPR.",
  path: "/privacy",
});

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const STRIPE_PRIVACY = "https://stripe.com/privacy";
const ANSPDCP = "https://www.dataprotection.ro";

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

export default function PrivacyPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Politica de confidențialitate">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Cine suntem</h2>
      <p>
        Operatorul platformei Frizeo (
        <ExtLink href={c.website}>{c.website}</ExtLink>) este{" "}
        <strong>{c.name}</strong>, CUI {c.cui}, înregistrată la Registrul
        Comerțului sub nr. {c.regCom}, cu sediul în {c.address}, reprezentată
        legal de {c.representative} („Operatorul”, „noi”).
      </p>
      <p>
        Contact privind protecția datelor și confidențialitatea:
      </p>
      <p>
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>

      <h2>2. Ce este Frizeo</h2>
      <p>
        Frizeo este o platformă software (SaaS) care permite frizeriilor,
        barbershop-urilor și saloanelor să își administreze programările
        online.
      </p>
      <p>
        Clienții finali se pot programa prin pagini publice generate de salon.
      </p>
      <p>
        Platforma este destinată în principal utilizatorilor din România:
      </p>
      <ul>
        <li>interfața este în limba română;</li>
        <li>suportul este oferit în limba română;</li>
        <li>moneda utilizată este RON;</li>
        <li>
          programările utilizează fusul orar Europe/Bucharest.
        </li>
      </ul>

      <h2>3. Ce date prelucrăm</h2>

      <h3>3.1 Conturile saloanelor (B2B)</h3>
      <p>Pentru funcționarea platformei putem prelucra:</p>
      <ul>
        <li>nume;</li>
        <li>adresă de email;</li>
        <li>număr de telefon;</li>
        <li>parola (stocată exclusiv sub formă hash);</li>
        <li>denumirea salonului;</li>
        <li>slug;</li>
        <li>logo;</li>
        <li>galerie foto;</li>
        <li>descriere;</li>
        <li>profilul frizerului;</li>
        <li>programul de lucru;</li>
        <li>serviciile oferite;</li>
        <li>durata serviciilor;</li>
        <li>prețurile serviciilor;</li>
        <li>informații privind abonamentul și utilizarea platformei.</li>
      </ul>

      <h3>Date de facturare</h3>
      <p>Pentru emiterea facturilor fiscale pot fi prelucrate:</p>
      <ul>
        <li>nume / denumire;</li>
        <li>adresă;</li>
        <li>CUI (dacă este cazul);</li>
        <li>alte informații fiscale necesare.</li>
      </ul>
      <p>
        Aceste informații sunt colectate prin Stripe Checkout și sincronizate
        în contul salonului pentru emiterea documentelor fiscale.
      </p>

      <h3>3.2 Clienții finali (programări)</h3>
      <p>La efectuarea unei programări pot fi colectate:</p>
      <ul>
        <li>nume;</li>
        <li>telefon;</li>
        <li>email (opțional);</li>
        <li>serviciul ales;</li>
        <li>data și ora programării;</li>
        <li>
          token-uri securizate pentru anulare și reprogramare.
        </li>
      </ul>

      <h3>3.3 Plăți și facturare (Stripe)</h3>
      <p>
        Pentru planurile plătite, plata abonamentelor este procesată prin
        Stripe.
      </p>
      <p>Frizeo nu stochează numărul complet al cardului bancar.</p>
      <p>Date procesate prin Stripe pot include:</p>
      <ul>
        <li>nume;</li>
        <li>email;</li>
        <li>adresă de facturare;</li>
        <li>CUI (persoane juridice);</li>
        <li>informațiile necesare procesării plății.</li>
      </ul>
      <p>
        În Frizeo sunt păstrate doar identificatorii tehnici necesari:
      </p>
      <ul>
        <li>Stripe Customer ID;</li>
        <li>Subscription ID;</li>
        <li>statusul abonamentului;</li>
        <li>perioada de facturare;</li>
        <li>istoricul tranzacțiilor.</li>
      </ul>
      <p>Politica Stripe:</p>
      <p>
        <ExtLink href={STRIPE_PRIVACY}>{STRIPE_PRIVACY}</ExtLink>
      </p>

      <h3>3.4 Google Calendar (opțional)</h3>
      <p>
        Conectarea Google Calendar este complet opțională și este inițiată
        exclusiv de utilizator din secțiunea Profil.
      </p>
      <p>
        La conectare sunt solicitate doar următoarele permisiuni OAuth:
      </p>
      <ul>
        <li>
          <code>
            <ExtLink href={CALENDAR_SCOPE}>{CALENDAR_SCOPE}</ExtLink>
          </code>
        </li>
        <li>
          <code>
            <ExtLink href={EMAIL_SCOPE}>{EMAIL_SCOPE}</ExtLink>
          </code>
        </li>
      </ul>
      <p>Aceste date sunt utilizate exclusiv pentru:</p>
      <ul>
        <li>
          crearea automată a unui eveniment la confirmarea unei programări;
        </li>
        <li>
          actualizarea evenimentului la modificarea unei programări;
        </li>
        <li>ștergerea evenimentului la anulare;</li>
        <li>
          citirea disponibilității calendarului (Free/Busy) pentru prevenirea
          programărilor suprapuse;
        </li>
        <li>
          afișarea contului Google conectat în profilul utilizatorului.
        </li>
      </ul>
      <p>
        Frizeo accesează exclusiv datele necesare pentru furnizarea acestor
        funcționalități.
      </p>
      <p>Nu solicităm alte permisiuni Google.</p>
      <p>
        Nu accesăm Gmail, Google Drive, Google Photos sau alte produse Google.
      </p>
      <p>Pentru informații suplimentare:</p>
      <p>
        <a href="/google-calendar-data">
          https://www.frizeo.ro/google-calendar-data
        </a>
      </p>

      <h3>Protecția datelor Google</h3>
      <p>
        OAuth Access Token și Refresh Token sunt stocate securizat și asociate
        exclusiv contului utilizatorului care a autorizat conexiunea.
      </p>
      <p>
        Datele Google Calendar sunt accesibile numai serviciilor backend
        necesare sincronizării calendarului.
      </p>
      <p>
        Utilizatorii pot revoca accesul în orice moment atât din aplicația
        Frizeo, cât și din contul Google (
        <ExtLink href={GOOGLE_POLICY_LINKS.revokeAccess}>
          {GOOGLE_POLICY_LINKS.revokeAccess}
        </ExtLink>
        ).
      </p>

      <h3>3.5 Date tehnice</h3>
      <p>
        Pentru funcționarea și securitatea platformei putem prelucra:
      </p>
      <ul>
        <li>cookie-uri de autentificare;</li>
        <li>loguri tehnice;</li>
        <li>
          adrese IP (în scopuri de securitate și prevenirea abuzurilor);
        </li>
        <li>informații despre browser și dispozitiv.</li>
      </ul>

      <h2>4. Temeiurile legale (GDPR)</h2>
      <p>Prelucrăm datele în baza următoarelor temeiuri:</p>

      <h3>Executarea contractului</h3>
      <ul>
        <li>furnizarea serviciului Frizeo;</li>
        <li>administrarea conturilor;</li>
        <li>gestionarea programărilor.</li>
      </ul>

      <h3>Interes legitim</h3>
      <ul>
        <li>securitatea platformei;</li>
        <li>prevenirea fraudelor;</li>
        <li>îmbunătățirea serviciului;</li>
        <li>diagnosticarea erorilor.</li>
      </ul>

      <h3>Consimțământ</h3>
      <p>Pentru:</p>
      <ul>
        <li>Google Analytics;</li>
        <li>Meta Pixel;</li>
        <li>TikTok Pixel;</li>
        <li>alte cookie-uri de marketing.</li>
      </ul>
      <p>
        Acestea sunt activate doar după acceptarea bannerului de cookie-uri.
      </p>

      <h3>Obligație legală</h3>
      <p>Pentru:</p>
      <ul>
        <li>contabilitate;</li>
        <li>obligații fiscale;</li>
        <li>arhivarea documentelor.</li>
      </ul>

      <h2>5. Destinatarii datelor</h2>
      <p>
        Datele pot fi prelucrate de furnizori care ne ajută să operăm
        serviciul.
      </p>
      <p>Aceștia includ:</p>
      <ul>
        <li>Supabase (bază de date și autentificare)</li>
        <li>Vercel (hosting)</li>
        <li>Zoho sau furnizorul de email</li>
        <li>SMSO (notificări SMS)</li>
        <li>Stripe (procesare plăți)</li>
        <li>Google (Google Calendar și Google Analytics)</li>
        <li>Meta Platforms</li>
        <li>TikTok</li>
      </ul>
      <p>
        Datele sunt transmise numai în măsura necesară furnizării serviciilor.
      </p>
      <p>
        Saloanele care utilizează Frizeo pot acționa ca operatori independenți
        pentru datele propriilor clienți.
      </p>
      <p>
        În aceste situații Frizeo acționează ca persoană împuternicită de
        operator.
      </p>

      <h2>6. Perioada de stocare</h2>
      <p>Datele sunt păstrate numai atât timp cât este necesar.</p>
      <p>Perioade orientative:</p>
      <ul>
        <li>cont activ: pe durata utilizării serviciului;</li>
        <li>
          programări: până la 24 luni după efectuarea acestora;
        </li>
        <li>
          documente fiscale: conform obligațiilor legale (în general 10 ani);
        </li>
        <li>
          cont șters: date șterse sau anonimizate în maximum 90 de zile, cu
          excepția obligațiilor legale.
        </li>
      </ul>

      <h3>Date Google Calendar</h3>
      <p>
        OAuth Access Token și Refresh Token sunt păstrate numai cât timp
        conexiunea Google Calendar este activă.
      </p>
      <p>
        La deconectarea Google Calendar, revocarea accesului sau ștergerea
        contului Frizeo, aceste token-uri sunt șterse definitiv.
      </p>

      <h2>7. Drepturile tale</h2>
      <p>Conform GDPR ai dreptul la:</p>
      <ul>
        <li>acces;</li>
        <li>rectificare;</li>
        <li>ștergere;</li>
        <li>restricționare;</li>
        <li>opoziție;</li>
        <li>portabilitate (unde este aplicabil);</li>
        <li>retragerea consimțământului.</li>
      </ul>
      <p>Ai dreptul să depui o plângere la:</p>
      <p>
        <ExtLink href={ANSPDCP}>{ANSPDCP}</ExtLink>
      </p>
      <p>Solicitările privind protecția datelor pot fi trimise la:</p>
      <p>
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
      <p>Vom răspunde în termen de maximum 30 de zile.</p>

      <h2>8. Securitate</h2>
      <p>
        Aplicăm măsuri tehnice și organizatorice rezonabile pentru protejarea
        datelor.
      </p>
      <p>Acestea includ:</p>
      <ul>
        <li>comunicații criptate HTTPS;</li>
        <li>parole stocate exclusiv sub formă hash;</li>
        <li>acces restricționat la infrastructura backend;</li>
        <li>autentificare și autorizare pentru accesul la date;</li>
        <li>
          monitorizarea și jurnalizarea accesului la serviciile critice.
        </li>
      </ul>

      <h3>Protecția datelor Google</h3>
      <p>
        Datele Google Calendar sunt accesibile exclusiv serviciilor backend
        necesare furnizării funcționalităților de sincronizare.
      </p>
      <p>
        Accesul la OAuth Access Token și Refresh Token este restricționat.
      </p>
      <p>
        Comunicarea cu Google API se realizează exclusiv prin conexiuni
        criptate HTTPS.
      </p>
      <p>
        Datele Google nu sunt utilizate în alte scopuri decât cele descrise în
        această politică.
      </p>

      <h2>9. Inteligență Artificială (AI)</h2>
      <p>
        Frizeo nu utilizează datele Google Calendar sau alte informații
        obținute prin Google API pentru dezvoltarea, îmbunătățirea sau
        antrenarea modelelor de Inteligență Artificială (AI) sau Machine
        Learning (ML).
      </p>
      <p>Datele Google:</p>
      <ul>
        <li>nu sunt utilizate pentru antrenarea modelelor AI;</li>
        <li>
          nu sunt transferate către furnizori AI terți pentru antrenarea
          modelelor;
        </li>
        <li>
          nu sunt utilizate pentru dezvoltarea unor modele generale de AI.
        </li>
      </ul>
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

      <h2>10. Modificări</h2>
      <p>
        Putem actualiza periodic această Politică de confidențialitate.
      </p>
      <p>Versiunea curentă este disponibilă permanent la:</p>
      <p>
        <a href="/privacy">{c.website}/privacy</a>
      </p>
    </LegalPageLayout>
  );
}
