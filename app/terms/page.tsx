import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Termeni și condiții",
  description:
    "Termenii de utilizare Frizeo: planuri, plăți Stripe, Google Calendar opțional, obligații și răspundere.",
  path: "/terms",
});

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

export default function TermsPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Termeni și condiții">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Părțile contractului</h2>
      <p>
        Prezentul document reglementează utilizarea platformei Frizeo (
        <ExtLink href={c.website}>{c.website}</ExtLink>), operată de{" "}
        <strong>{c.name}</strong>, CUI {c.cui}, cu sediul în {c.address}{" "}
        („Frizeo”, „noi”).
      </p>
      <p>
        Utilizatorul („Salonul”, „tu”) este persoana fizică autorizată sau
        persoana juridică care creează un cont și utilizează serviciile
        Frizeo.
      </p>
      <p>
        Prin crearea unui cont, accesarea sau utilizarea platformei Frizeo,
        confirmi că ai citit, ai înțeles și accepți prezentii Termeni și
        condiții, precum și{" "}
        <a href="/privacy">Politica de confidențialitate</a>,{" "}
        <a href="/google-calendar-data">
          Politica privind utilizarea datelor Google Calendar
        </a>{" "}
        și celelalte politici publicate pe site.
      </p>

      <h2>2. Serviciul</h2>
      <p>
        Frizeo este o platformă software (SaaS) destinată administrării
        programărilor online pentru frizerii, barbershop-uri și saloane.
      </p>
      <p>
        Platforma oferă, în funcție de planul ales:
      </p>
      <ul>
        <li>calendar programări;</li>
        <li>gestionarea serviciilor;</li>
        <li>link public de programare;</li>
        <li>notificări prin email;</li>
        <li>notificări SMS (unde sunt incluse în plan);</li>
        <li>administrarea frizerilor;</li>
        <li>program de lucru;</li>
        <li>zile speciale;</li>
        <li>
          alte funcționalități disponibile la momentul utilizării.
        </li>
      </ul>
      <p>
        Platforma este destinată în principal pieței din România.
      </p>
      <p>Interfața este disponibilă în limba română.</p>
      <p>Prețurile sunt exprimate în lei (RON).</p>
      <p>
        Programările utilizează fusul orar Europe/Bucharest.
      </p>

      <h3>2.1 Google Calendar (opțional)</h3>
      <p>
        Utilizatorii pot conecta opțional contul Google Calendar pentru
        sincronizarea automată a programărilor.
      </p>
      <p>
        Conectarea se realizează exclusiv la inițiativa utilizatorului și
        necesită autorizarea prin Google OAuth.
      </p>
      <p>Integrarea permite:</p>
      <ul>
        <li>crearea evenimentelor;</li>
        <li>actualizarea acestora;</li>
        <li>ștergerea acestora;</li>
        <li>
          verificarea intervalelor ocupate (Free/Busy) pentru prevenirea
          programărilor suprapuse.
        </li>
      </ul>
      <p>
        Deconectarea Google Calendar nu afectează funcționalitățile principale
        ale platformei Frizeo.
      </p>
      <p>Utilizarea datelor Google este descrisă în:</p>
      <ul>
        <li>
          <a href="/privacy">Politica de confidențialitate</a>;
        </li>
        <li>
          <a href="/google-calendar-data">
            Pagina „Utilizarea datelor Google Calendar”
          </a>
          .
        </li>
      </ul>

      <h2>3. Cont și eligibilitate</h2>
      <p>Pentru utilizarea platformei trebuie:</p>
      <ul>
        <li>să ai minimum 18 ani;</li>
        <li>să ai capacitate legală de a încheia contracte;</li>
        <li>să furnizezi informații corecte și actualizate;</li>
        <li>
          să păstrezi confidențialitatea datelor de autentificare.
        </li>
      </ul>
      <p>Fiecare salon trebuie să utilizeze propriul cont.</p>
      <p>
        Ești responsabil pentru toate activitățile desfășurate prin contul
        tău.
      </p>

      <h2>4. Planuri și prețuri</h2>
      <p>
        La data actualizării prezentului document sunt disponibile următoarele
        planuri:
      </p>

      <h3>Free</h3>
      <ul>
        <li>0 lei / lună</li>
        <li>1 frizer</li>
        <li>80 programări / lună</li>
        <li>fără SMS</li>
      </ul>

      <h3>Pro</h3>
      <ul>
        <li>59 lei / lună</li>
        <li>1 frizer</li>
        <li>programări nelimitate</li>
        <li>SMS inclus</li>
      </ul>

      <h3>Pro+</h3>
      <ul>
        <li>129 lei / lună</li>
        <li>până la 3 frizeri</li>
        <li>programări nelimitate</li>
        <li>SMS inclus</li>
      </ul>

      <h3>Custom</h3>
      <p>Plan personalizat, stabilit individual.</p>

      <h3>Trial</h3>
      <p>
        Frizeo oferă o perioadă de test gratuit de 60 de zile, cu acces la
        funcționalitățile planului Pro+, inclusiv notificări SMS.
      </p>
      <p>
        La expirarea perioadei Trial, dacă nu este activat un abonament plătit,
        contul este trecut automat pe planul Free.
      </p>

      <h3>4.1 Plata abonamentului</h3>
      <p>Plățile sunt procesate prin Stripe.</p>
      <p>
        La activarea unui abonament plătit utilizatorul este redirecționat
        către Stripe Checkout pentru introducerea datelor de facturare și a
        metodei de plată.
      </p>
      <p>
        Frizeo nu stochează numărul complet al cardului bancar.
      </p>
      <p>
        Stripe este un furnizor independent de servicii de plată.
      </p>
      <p>
        Frizeo nu este responsabilă pentru eventualele indisponibilități sau
        erori ale serviciilor Stripe.
      </p>

      <h3>Reînnoire</h3>
      <p>
        Abonamentele se reînnoiesc automat lunar până la anularea acestora.
      </p>

      <h3>Upgrade</h3>
      <p>Poți trece oricând la un plan superior.</p>
      <p>
        În funcție de regulile Stripe, diferența de preț poate fi calculată
        proporțional (proratare).
      </p>

      <h3>Downgrade</h3>
      <p>
        Dacă funcționalitatea nu este disponibilă direct din platformă,
        solicitarea se poate transmite la:
      </p>
      <p>
        <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>
      </p>

      <h3>Plăți eșuate</h3>
      <p>
        În cazul în care plata nu poate fi procesată:
      </p>
      <ul>
        <li>abonamentul poate intra în stare de restanță;</li>
        <li>anumite funcționalități pot fi limitate;</li>
        <li>
          utilizatorul va fi notificat și va putea finaliza plata prin Stripe.
        </li>
      </ul>

      <h3>Facturare</h3>
      <p>
        După confirmarea plății, Frizeo emite factura fiscală folosind
        SmartBill sau un sistem echivalent.
      </p>
      <p>
        Facturile sunt emise pe baza informațiilor de facturare furnizate de
        utilizator.
      </p>
      <p>
        TVA-ul se aplică conform legislației în vigoare.
      </p>

      <h3>SMS</h3>
      <p>
        Notificările SMS sunt disponibile doar în planurile care includ această
        funcționalitate și în perioada Trial.
      </p>

      <h3>Plan Custom</h3>
      <p>Planurile Custom sunt stabilite individual.</p>
      <p>
        Condițiile comerciale și metoda de plată sunt negociate separat.
      </p>

      <h3>4.2 Anularea abonamentului</h3>
      <p>
        Utilizatorul poate solicita anularea abonamentului în orice moment.
      </p>
      <p>
        Dacă funcționalitatea este disponibilă în platformă, anularea se poate
        realiza direct din contul Frizeo.
      </p>
      <p>
        În caz contrar, solicitarea poate fi transmisă la:
      </p>
      <p>
        <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>
      </p>
      <p>
        Anularea produce efect, de regulă, la sfârșitul perioadei de facturare
        deja achitate.
      </p>

      <h2>5. Obligațiile Salonului</h2>
      <p>Salonul se obligă:</p>
      <ul>
        <li>să respecte legislația aplicabilă;</li>
        <li>
          să respecte GDPR în relația cu propriii clienți;
        </li>
        <li>să furnizeze informații corecte;</li>
        <li>să mențină actualizate datele contului;</li>
        <li>să nu utilizeze platforma în scopuri ilegale;</li>
        <li>
          să nu încerce accesarea neautorizată a sistemelor Frizeo;
        </li>
        <li>să nu perturbe funcționarea platformei;</li>
        <li>să fie responsabil pentru conținutul publicat.</li>
      </ul>

      <h2>6. Obligațiile Frizeo</h2>
      <p>
        Frizeo depune toate eforturile rezonabile pentru furnizarea serviciului.
      </p>
      <p>Putem efectua:</p>
      <ul>
        <li>mentenanță;</li>
        <li>actualizări;</li>
        <li>modificări tehnice.</li>
      </ul>
      <p>
        Atunci când este posibil, utilizatorii vor fi informați în prealabil.
      </p>
      <p>
        Frizeo nu garantează funcționarea neîntreruptă sau lipsa completă a
        erorilor.
      </p>
      <p>Pot exista întreruperi cauzate de:</p>
      <ul>
        <li>lucrări de mentenanță;</li>
        <li>probleme ale furnizorilor terți;</li>
        <li>întreruperi internet;</li>
        <li>
          probleme Google, Stripe sau alte servicii integrate;
        </li>
        <li>
          evenimente aflate în afara controlului nostru.
        </li>
      </ul>

      <h2>7. Proprietate intelectuală</h2>
      <p>
        Platforma Frizeo, codul sursă, designul, logo-ul, mărcile și toate
        elementele software aparțin {c.name}.
      </p>
      <p>
        Utilizatorii păstrează drepturile asupra datelor și conținutului
        încărcat în platformă.
      </p>
      <p>
        Frizeo utilizează aceste date exclusiv pentru furnizarea serviciilor
        descrise în acești Termeni și în{" "}
        <a href="/privacy">Politica de confidențialitate</a>.
      </p>

      <h2>8. Limitarea răspunderii</h2>
      <p>Frizeo nu răspunde pentru:</p>
      <ul>
        <li>pierderi indirecte;</li>
        <li>pierderi de profit;</li>
        <li>
          programări ratate cauzate de indisponibilitatea serviciilor terțe;
        </li>
        <li>întreruperi ale internetului;</li>
        <li>
          erori ale serviciilor Google, Stripe, SMS sau email.
        </li>
      </ul>
      <p>
        În măsura permisă de lege, răspunderea totală a Frizeo este limitată la
        valoarea abonamentelor plătite de utilizator în ultimele 12 luni.
      </p>

      <h2>9. Forță majoră</h2>
      <p>
        Frizeo nu răspunde pentru întârzieri sau imposibilitatea furnizării
        serviciilor cauzate de evenimente aflate în afara controlului nostru
        rezonabil.
      </p>
      <p>Acestea pot include, fără limitare:</p>
      <ul>
        <li>dezastre naturale;</li>
        <li>incendii;</li>
        <li>războaie;</li>
        <li>atacuri informatice de amploare;</li>
        <li>întreruperi majore ale internetului;</li>
        <li>decizii ale autorităților;</li>
        <li>alte evenimente de forță majoră.</li>
      </ul>

      <h2>10. Suspendarea și încetarea serviciului</h2>
      <p>
        Utilizatorul poate înceta utilizarea platformei în orice moment.
      </p>
      <p>
        Frizeo poate suspenda sau restricționa accesul în cazul:
      </p>
      <ul>
        <li>încălcării prezentelor condiții;</li>
        <li>activităților frauduloase;</li>
        <li>utilizării ilegale;</li>
        <li>încercărilor de acces neautorizat;</li>
        <li>neplății prelungite;</li>
        <li>
          utilizării care afectează securitatea sau funcționarea platformei.
        </li>
      </ul>
      <p>
        Datele vor fi tratate conform{" "}
        <a href="/privacy">Politicii de confidențialitate</a>.
      </p>

      <h2>11. Modificări</h2>
      <p>
        Frizeo poate actualiza periodic acești Termeni și condiții.
      </p>
      <p>
        Modificările semnificative vor fi comunicate prin email sau în cadrul
        platformei.
      </p>
      <p>
        Continuarea utilizării serviciului după intrarea în vigoare a
        modificărilor reprezintă acceptarea acestora.
      </p>

      <h2>12. Legea aplicabilă</h2>
      <p>
        Prezentul document este guvernat de legislația din România.
      </p>
      <p>
        Părțile vor încerca soluționarea pe cale amiabilă a eventualelor
        litigii.
      </p>
      <p>
        În lipsa unei soluții amiabile, litigiile vor fi soluționate de
        instanțele competente din România.
      </p>

      <h2>13. Contact</h2>
      <p>Pentru întrebări privind utilizarea platformei:</p>
      <p>
        <a href={`mailto:${c.email}`}>{c.email}</a>
      </p>
      <p>Pentru abonamente și facturare:</p>
      <p>
        <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>
      </p>
      <p>
        <strong>Operator:</strong>
      </p>
      <p>{c.name}</p>
      <p>{c.address}</p>
    </LegalPageLayout>
  );
}
