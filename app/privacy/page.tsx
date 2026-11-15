import LegalPageLayout from "@/app/components/LegalPageLayout";
import { GOOGLE_POLICY_LINKS } from "@/lib/legal/googleCalendar";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Politica de confidențialitate",
  description:
    "Cum prelucrăm datele personale în Frizeo: conturi salon, programări, plăți Stripe, Google Calendar și integrările Meta, TikTok și Google Business Profile.",
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
    <LegalPageLayout title="Politica de confidențialitate" path="/privacy">
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
      <p>
        Telefon / WhatsApp Business:{" "}
        <a href={`tel:${c.phoneE164}`}>{c.phone}</a>
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
      <p>
        Conexiunea Google Calendar nu solicită alte permisiuni decât cele două
        de mai sus.
      </p>
      <p>
        Nu accesăm conținutul Gmail, Google Drive sau Google Photos prin
        conexiunea Calendar.
      </p>
      <p>
        Google Business Profile este o conexiune separată, descrisă la
        secțiunea 3.5. Nu este folosită pentru Calendar.
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

      <h3>3.5 Meta, TikTok și Google Business Profile (opționale)</h3>
      <p>
        Conectarea Facebook, Instagram, TikTok sau Google Business Profile
        este opțională și pornește doar din Integrări, de către un owner sau
        manager al salonului. Fără această acțiune, Frizeo nu cere token și nu
        publică.
      </p>
      <p>Pentru Meta (Facebook și Instagram) sunt cerute permisiunile:</p>
      <ul>
        <li><code>business_management</code></li>
        <li><code>pages_show_list</code></li>
        <li><code>pages_read_engagement</code></li>
        <li><code>pages_manage_posts</code></li>
        <li><code>instagram_basic</code></li>
        <li><code>instagram_content_publish</code></li>
      </ul>
      <p>Din contul Meta citim și păstrăm, pentru salonul care a conectat:</p>
      <ul>
        <li>identificatorul contului Meta și numele afișat;</li>
        <li>identificatorul, numele și sarcinile paginilor Facebook alese;</li>
        <li>
          identificatorul și numele de utilizator ale contului Instagram
          profesional legat de pagina aleasă;
        </li>
        <li>
          tokenul de acces, criptat, împreună cu permisiunile acordate și data
          de expirare.
        </li>
      </ul>
      <p>
        La o publicare, Meta primește textul și adresa temporară a imaginii.
        Tokenul de pagină este cerut la momentul publicării și nu este păstrat
        separat de tokenul contului. Pentru verificarea unei postări Instagram,
        putem citi identificatorul, textul, data, tipul și adresa media ale
        acelei postări.
      </p>
      <p>Pentru TikTok sunt folosite:</p>
      <ul>
        <li>
          <code>user.info.basic</code>, pentru <code>open_id</code> și numele
          afișat;
        </li>
        <li>
          <code>video.upload</code>, doar dacă salonul autorizează încărcarea.
          Ea trimite titlul, descrierea și adresa temporară a imaginii sau a
          videoclipului către inbox-ul contului.
        </li>
      </ul>
      <p>
        Permisiunea <code>video.publish</code> nu este cerută, iar publicarea
        directă pe TikTok nu este activată în aplicație. Tokenul TikTok este
        păstrat criptat, cu permisiunile și expirarea.
      </p>
      <p>
        Pentru Google Business Profile este cerută permisiunea{" "}
        <code>https://www.googleapis.com/auth/business.manage</code>. Dacă
        Google mai întoarce <code>openid</code>, <code>email</code>,{" "}
        <code>profile</code> sau adresa din{" "}
        <code>userinfo</code>, acestea pot fi păstrate. Un scope de Calendar
        este refuzat pe această conexiune.
      </p>
      <p>Din Google Business Profile citim și păstrăm:</p>
      <ul>
        <li>identificatorul contului și al locației alese, plus numele locației;</li>
        <li>tokenul de acces și tokenul de reîmprospătare, criptate;</li>
        <li>permisiunile și expirarea tokenului.</li>
      </ul>
      <p>
        La o publicare, Google primește textul în limba română, o singură
        fotografie printr-o adresă temporară și, numai dacă există un link
        public <code>https://frizeo.ro/booking/…</code> sau{" "}
        <code>https://www.frizeo.ro/booking/…</code>, butonul Rezervă. Un alt
        link nu este trimis.
      </p>
      <p>
        Imaginile pregătite pentru publicare stau într-un spațiu privat.
        Platforma primește o adresă semnată, cu durată limitată, nu acces
        permanent la fișier. Istoricul din Frizeo poate păstra textul, calea
        fișierului, statusul, numărul de încercări și identificatorul postării
        de pe platformă.
      </p>
      <p>
        Nu folosim aceste tokenuri sau identificatori pentru reclame Frizeo,
        pentru profilarea vizitatorilor sau pentru antrenarea modelelor de
        inteligență artificială.
      </p>

      <h3>3.6 Date tehnice</h3>
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
        <li>Microsoft Clarity;</li>
        <li>alte cookie-uri de marketing.</li>
      </ul>
      <p>
        Acestea sunt activate doar după acceptarea bannerului de cookie-uri.
        Pixelii sunt separați de conectarea OAuth a paginii, contului TikTok
        sau profilului Google Business.
      </p>

      <h3>Executarea contractului pentru integrările opționale</h3>
      <p>
        Pentru conectarea și publicarea cerute de salon, temeiul executării
        contractului, art. 6 alin. (1) lit. b din GDPR, este doar o propunere.
        Nu este o decizie juridică confirmată. Operatorul trebuie să o
        confirme sau să o înlocuiască înainte de promovarea în producție.
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
        <li>FGO (emitere facturi fiscale, când este configurat)</li>
        <li>Google (Google Calendar, Google Business Profile și Google Analytics)</li>
        <li>OpenAI și/sau Google Gemini (Marketing AI și Assistant, când sunt activate)</li>
        <li>Notion (sincronizare internă operațională, când este configurată)</li>
        <li>Meta Platforms Ireland Ltd. (Facebook, Instagram și Meta Pixel)</li>
        <li>TikTok Technology Limited (conectare, încărcare și TikTok Pixel)</li>
        <li>Microsoft (Microsoft Clarity)</li>
      </ul>
      <p>
        Datele sunt transmise numai în măsura necesară furnizării serviciilor.
        Meta primește datele descrise la secțiunea 3.5 atunci când salonul
        conectează sau publică. TikTok primește identificatorul de bază și,
        la o încărcare autorizată, textul și adresa temporară a fișierului.
        Google Business Profile primește textul, fotografia și, când există,
        linkul public de programare.
      </p>
      <p>
        Meta, TikTok și Google pot prelucra aceste date și în afara României
        sau a Spațiului Economic European. Această politică nu stabilește
        mecanismul de transfer, cum ar fi o decizie de adecvare sau clauze
        contractuale. Operatorul trebuie să confirme mecanismul pentru fiecare
        furnizor înainte de promovarea în producție.
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
      <p>
        Termenul de mai sus nu acoperă automat conexiunile Meta, TikTok și
        Google Business Profile și nici fișierele lor. Această politică nu
        alege un număr de zile pentru ele.
      </p>

      <h3>Date Google Calendar</h3>
      <p>
        OAuth Access Token și Refresh Token sunt păstrate numai cât timp
        conexiunea Google Calendar este activă.
      </p>
      <p>
        La deconectarea Google Calendar, revocarea accesului sau ștergerea
        contului Frizeo, aceste token-uri sunt șterse definitiv.
      </p>

      <h3>Datele integrărilor Meta, TikTok și Google Business Profile</h3>
      <p>
        Tokenul unei integrări este șters din Frizeo când salonul o
        deconectează din Integrări. Odată cu conexiunea se șterg destinațiile
        salvate și rândurile de publicare legate de ele.
      </p>
      <p>
        Textul unei campanii și fișierul privat rămân după deconectare dacă
        nu mai există un rând de publicare. Aplicația le poate șterge doar
        când operatorul setează variabila{" "}
        <code>MARKETING_DATA_RETENTION_DAYS</code> la un număr întreg de zile.
        Până atunci nu se șterge nimic automat. Numărul nu este stabilit aici
        și nu reprezintă o perioadă legală confirmată. Ștergerea automată nu
        atinge conexiunile active, joburile de publicare, programările sau
        documentele fiscale.
      </p>
      <p>
        Postarea deja trimisă rămâne la Meta, TikTok sau Google, după
        regulile acelei platforme. Deconectarea din Frizeo nu o șterge acolo.
      </p>
      <p>
        O cerere semnată de Meta, la deautorizare sau la ștergerea datelor,
        închide doar conexiunile Meta ale contului Facebook care a semnat-o.
        Semnătura invalidă nu șterge nimic. TikTok și Google nu sunt atinse.
      </p>
      <p>
        Ștergerea contului unui utilizator nu deconectează automat aceste
        integrări, pentru că aparțin salonului. Instrucțiunile sunt pe pagina{" "}
        <a href="/stergere-date">Ștergerea datelor din integrări</a>.
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
      <p>
        Accesul la o integrare se retrage din Integrări, prin deconectare.
        Google Calendar se deconectează din Profil. Accesul poate fi retras și
        din contul Meta, TikTok sau Google. Pașii sunt pe pagina{" "}
        <a href="/stergere-date">Ștergerea datelor din integrări</a>.
      </p>
      <p>Ai dreptul să depui o plângere la:</p>
      <p>
        <ExtLink href={ANSPDCP}>{ANSPDCP}</ExtLink>
      </p>
      <p>Solicitările privind protecția datelor pot fi trimise la:</p>
      <p>
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
      <p>
        Telefon / WhatsApp Business:{" "}
        <a href={`tel:${c.phoneE164}`}>{c.phone}</a>
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
          autentificare și autorizare pentru accesul la date.
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
        această politică. Aceeași limită se aplică tokenurilor și
        identificatorilor primiți de la Meta și TikTok.
      </p>

      <h2>9. Inteligență Artificială (AI)</h2>
      <p>
        Frizeo poate folosi modele AI (OpenAI și/sau Google Gemini) pentru
        funcții opționale precum Marketing AI și Assistant, pe baza datelor din
        contul salonului (ex.: servicii, programări, mesaje din chat). Aceste
        date sunt trimise către furnizorul AI doar pentru generarea răspunsului
        / conținutului solicitat.
      </p>
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
