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

      <h2>4. Cine decide și pe ce temei</h2>
      <p>
        Pentru contul salonului, abonament și facturile Frizeo, operator este{" "}
        {c.name}. Pentru programările clienților, operator este salonul.
        Frizeo prelucrează acele programări doar ca să furnizeze serviciul
        cerut de salon și este persoană împuternicită. Termenii nu țin locul
        acordului de prelucrare dintre Frizeo și salon.
      </p>
      <p>
        Autorizarea dată pe ecranul Meta, TikTok sau Google permite aplicației
        să acceseze contul ales. Ea nu este consimțământul GDPR folosit pentru
        cookie-urile de analiză și marketing.
      </p>

      <h3>Proprietarii de saloane</h3>
      <p>
        Contul, abonamentul și funcțiile cerute de proprietar sunt necesare
        pentru executarea contractului, art. 6 alin. (1) lit. b din GDPR.
        Facturile Frizeo sunt păstrate pentru obligația legală, art. 6 alin.
        (1) lit. c. Jurnalele de securitate și limitarea abuzurilor se bazează
        pe interesul legitim, art. 6 alin. (1) lit. f.
      </p>

      <h3>Manageri și angajați</h3>
      <p>
        Contul lor există ca să poată folosi platforma cumpărată de salon.
        Frizeo îl prelucrează pentru executarea acelui contract. Salonul
        decide pe cine invită și rămâne responsabil pentru datele clienților
        pe care aceștia le văd.
      </p>

      <h3>Clienții care se programează</h3>
      <p>
        Numele, telefonul, emailul opțional și detaliile programării sunt
        prelucrate pentru salon. Frizeo nu cere un consimțământ separat pentru
        programare și nu folosește aceste date pentru reclamele proprii.
      </p>

      <h3>Integrările Meta, TikTok, Google Business și Calendar</h3>
      <p>
        Conectarea și publicarea pornesc doar când un owner sau manager le
        cere din cont. Păstrarea tokenului și trimiterea textului sau a
        imaginii cerute sunt parte din executarea contractului cu salonul,
        art. 6 alin. (1) lit. b. Tokenul este păstrat cât timp conexiunea este
        folosită.
      </p>

      <h3>Vizitatori și tehnologii de analiză</h3>
      <p>
        Cookie-ul de autentificare este necesar pentru cont. Meta Pixel,
        TikTok Pixel, Google Analytics și Microsoft Clarity pornesc doar după
        acceptarea din banner, pe baza consimțământului, art. 6 alin. (1) lit.
        a. Refuzul lasă site-ul utilizabil.
      </p>

      <h3>Obligație legală</h3>
      <p>Pentru facturile și evidențele contabile ale Frizeo.</p>

      <h2>5. Destinatarii datelor</h2>
      <p>
        Datele pot fi prelucrate de furnizori care ne ajută să operăm
        serviciul.
      </p>
      <p>Aceștia includ:</p>
      <ul>
        <li>Supabase (bază de date și autentificare)</li>
        <li>Vercel (hosting)</li>
        <li>furnizorul de email configurat pentru notificări;</li>
        <li>NOOH MEDIA S.R.L. (SMSO), pentru SMS, când planul include SMS;</li>
        <li>Stripe, pentru plata abonamentului;</li>
        <li>FGO, pentru facturi, când facturarea este configurată;</li>
        <li>
          Google Ireland Limited și Google LLC, pentru Calendar, Business
          Profile, Analytics și, când este folosit, Gemini;
        </li>
        <li>
          OpenAI Ireland Limited, pentru Marketing AI sau Assistant, când
          aceste funcții sunt folosite;
        </li>
        <li>Notion, pentru evidența internă, când sincronizarea este pornită;</li>
        <li>
          Meta Platforms Ireland Limited și Meta Platforms, Inc., pentru
          Facebook, Instagram și Meta Pixel;
        </li>
        <li>
          TikTok Technology Limited, pentru conectare, încărcare și TikTok
          Pixel;
        </li>
        <li>
          Microsoft Ireland Operations Limited și Microsoft Corporation, pentru
          Microsoft Clarity.
        </li>
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
        Unii furnizori pot prelucra date în afara României sau a Spațiului Economic European.
        Mai jos sunt mecanismele publicate de ei la 15
        noiembrie 2026. Frizeo nu adaugă o garanție proprie peste documentele
        lor, iar înscrierea într-un program poate fi retrasă de furnizor.
      </p>
      <ul>
        <li>
          Meta Ireland indică EU–US Data Privacy Framework pentru transferul
          către Meta Platforms, Inc.{" "}
          <ExtLink href="https://www.facebook.com/legal/EU_data_transfer_addendum">
            Addendum-ul Meta
          </ExtLink>{" "}
          și{" "}
          <ExtLink href="https://www.dataprivacyframework.gov/participant/4452">
            lista oficială
          </ExtLink>
          .
        </li>
        <li>
          TikTok Technology Limited descrie stocarea în Statele Unite, Malaysia
          și Singapore și folosirea deciziilor de adecvare sau a clauzelor
          contractuale standard.{" "}
          <ExtLink href="https://www.tiktok.com/legal/page/eea/privacy-policy/en">
            Politica TikTok pentru SEE
          </ExtLink>
          .
        </li>
        <li>
          Google LLC este înscris în EU–US Data Privacy Framework și indică
          clauze contractuale standard acolo unde o decizie de adecvare nu
          acoperă transferul.{" "}
          <ExtLink href="https://policies.google.com/privacy/frameworks">
            Cadrele publicate de Google
          </ExtLink>
          .
        </li>
        <li>
          Microsoft Corporation este înscris în EU–US Data Privacy Framework.
          Pentru Clarity, clienții din UE contractează cu Microsoft Ireland
          Operations Limited, iar transferul intern folosește clauze
          contractuale standard.{" "}
          <ExtLink href="https://learn.microsoft.com/en-us/clarity/faq">
            Întrebările Microsoft Clarity
          </ExtLink>
          .
        </li>
        <li>
          Stripe, LLC este înscris în EU–US Data Privacy Framework, cu clauze
          contractuale standard dacă acest mecanism nu poate fi folosit.{" "}
          <ExtLink href="https://stripe.com/legal/dta">
            Addendum-ul Stripe
          </ExtLink>
          .
        </li>
        <li>
          Supabase Pte. Ltd. include clauze contractuale standard în acordul
          său de prelucrare. Baza de date stă în regiunea aleasă pentru
          proiect; suportul și unele jurnale pot fi prelucrate în afara ei.{" "}
          <ExtLink href="https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq">
            Explicația Supabase
          </ExtLink>
          .
        </li>
        <li>
          Vercel Inc. este înscris în EU–US Data Privacy Framework, iar acordul
          său spune că prelucrarea principală este în Statele Unite și include
          clauze contractuale standard.{" "}
          <ExtLink href="https://vercel.com/legal/dpa">Acordul Vercel</ExtLink>.
        </li>
        <li>
          OpenAI Ireland Limited indică decizii de adecvare sau clauze
          contractuale standard, nu EU–US Data Privacy Framework.{" "}
          <ExtLink href="https://openai.com/policies/eu-privacy-policy/">
            Politica OpenAI pentru UE
          </ExtLink>
          .
        </li>
      </ul>
      <p>
        Pentru datele clienților care se programează, salonul este operator, iar
        Frizeo este persoană împuternicită.
      </p>

      <h2>6. Perioada de stocare</h2>
      <p>Datele sunt păstrate numai atât timp cât este necesar pentru scopul descris.</p>
      <ul>
        <li>contul activ: pe durata folosirii serviciului;</li>
        <li>
          programările: rămân în contul salonului cât timp salonul folosește
          serviciul. Frizeo nu le șterge automat după un număr de luni și nu le
          șterge când pleacă un singur utilizator. Salonul nu are încă un
          export complet sau un buton de închidere; cererea se trimite la{" "}
          <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>;
        </li>
        <li>
          facturile și evidențele contabile: cel puțin 5 ani, calculați de la 1
          iulie a anului următor încheierii exercițiului financiar în care au
          fost întocmite, conform art. 25 din Legea contabilității nr. 82/1991,
          modificat prin Legea nr. 36/2023. Aplicația nu le șterge la ștergerea
          contului și nu le șterge automat la expirarea termenului;
        </li>
        <li>
          tokenurile Google Calendar, Meta, TikTok și Google Business Profile:
          cât timp conexiunea este folosită. Deconectarea din Frizeo le șterge.
          Ștergerea contului șterge tokenurile Google Calendar ale acelui
          utilizator. Revocarea din contul Meta, TikTok sau Google oprește
          accesul viitor, dar nu șterge singură tokenul deja salvat;
        </li>
        <li>
          campaniile folosite și istoricul unei publicări: cât timp țin de
          conexiunea sau de publicarea respectivă. La deconectare se șterge
          istoricul legat de acea conexiune. Istoricul rămas în cont nu este
          șters automat;
        </li>
        <li>
          textul și imaginea care nu mai au conexiune activă și nu au istoric
          de publicare: nu sunt șterse automat. Pot fi cerute la{" "}
          <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>.
        </li>
      </ul>
      <p>
        O cerere semnată de Meta, la scoaterea aplicației sau la ștergerea
        datelor, închide doar conexiunile Meta ale contului Facebook care a
        semnat-o. O semnătură care nu se verifică nu șterge nimic. TikTok,
        Google, programările și facturile nu intră în acea cerere. Postarea deja
        publicată rămâne pe platforma respectivă.
      </p>
      <p>
        Ștergerea contului are un răgaz de 7 zile, în care poate fi anulată.
        După finalizare se șterge utilizatorul, se anonimizează profilul de
        frizer și se șterg tokenurile lui de Google Calendar. Integrările
        salonului rămân, pentru că aparțin salonului. Pașii sunt pe pagina{" "}
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
        Pentru jurnalele de securitate, opoziția se trimite la{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>. O putem
        refuza doar dacă păstrarea este necesară pentru securitate sau pentru
        o obligație legală.
      </p>
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
      <p>
        Răspundem fără întârzieri nejustificate și, de regulă, într-o lună de la
        primirea cererii. Termenul poate fi prelungit cu cel mult două luni
        când cererea este complexă sau când sunt multe cereri. Te anunțăm în
        prima lună dacă prelungim termenul și de ce. Putem cere informațiile
        necesare ca să confirmăm identitatea. Dacă nu dăm curs cererii, îți
        spunem motivul și că poți sesiza ANSPDCP sau instanța.
      </p>

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
        <li>tokenuri de integrare păstrate cifrat, separat de datele publice.</li>
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
