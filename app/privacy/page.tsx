import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Politica de confidențialitate",
  description:
    "Cum prelucrăm datele personale în Frizeo: conturi salon, programări, plăți Stripe și drepturile tale GDPR.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Politica de confidențialitate">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Cine suntem</h2>
      <p>
        Operatorul platformei Frizeo ({c.website}) este{" "}
        <strong>{c.name}</strong>, CUI {c.cui}, înregistrată la Registrul
        Comerțului sub nr. {c.regCom}, cu sediul în {c.address},
        reprezentată legal de {c.representative} („Operatorul”, „noi”).
      </p>
      <p>
        Contact confidențialitate:{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>

      <h2>2. Ce este Frizeo</h2>
      <p>
        Frizeo este o platformă software (SaaS) prin care frizerii și saloanele
        își gestionează programările online. Clienții finali se programează
        prin link-uri publice generate de salon.
      </p>
      <p>
        Serviciul este destinat în principal pieței din{" "}
        <strong>România</strong>: interfața și suportul sunt în limba română,
        prețurile sunt exprimate în lei (RON), iar programările și notificările
        folosesc fusul orar <strong>Europe/Bucharest</strong>.
      </p>

      <h2>3. Ce date prelucrăm</h2>
      <h3>3.1. Conturi salon (clienți B2B)</h3>
      <ul>
        <li>Nume, email, telefon, parolă (hash)</li>
        <li>Date salon: nume, slug, logo, galerie, descriere</li>
        <li>Profil frizer: nume afișat, telefon, avatar, program</li>
        <li>Servicii, prețuri, durate</li>
        <li>Date abonament și utilizare platformă</li>
        <li>
          Date de facturare (persoană fizică sau juridică): nume/denumire,
          adresă, CUI (dacă e cazul), colectate în Stripe Checkout și
          sincronizate în contul salonului pentru emiterea facturilor fiscale
        </li>
      </ul>

      <h3>3.2. Clienți finali (programări B2C)</h3>
      <ul>
        <li>Nume, telefon</li>
        <li>Email (opțional)</li>
        <li>Data, ora și serviciul programat</li>
        <li>Token-uri pentru anulare/reprogramare</li>
      </ul>

      <h3>3.3. Plăți și facturare (Stripe)</h3>
      <p>
        Pentru planurile plătite, plata abonamentului lunar se face prin{" "}
        <strong>Stripe</strong>. Nu stocăm pe serverele Frizeo numărul complet
        al cardului bancar; acesta este procesat direct de Stripe.
      </p>
      <ul>
        <li>Date transmise către Stripe: email, nume, adresă de facturare, CUI (PJ), date card</li>
        <li>Identificatori Stripe (client, abonament, tranzacții) — păstrați în contul tău Frizeo</li>
        <li>Istoric abonament: plan activ, status plată, perioadă curentă</li>
      </ul>
      <p>
        Politica de confidențialitate Stripe:{" "}
        <a
          href="https://stripe.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          stripe.com/privacy
        </a>
      </p>

      <h3>3.4. Google Calendar (opțional, inițiat de frizer)</h3>
      <p>
        Dacă un frizer alege să conecteze Google Calendar din Profil, Frizeo
        solicită acces OAuth la Google Calendar și la adresa de email Google
        conectată. Conectarea este <strong>opțională</strong> și necesită
        acțiune explicită a frizerului.
      </p>
      <p>
        Scope-uri solicitate:{" "}
        <code>https://www.googleapis.com/auth/calendar</code> și{" "}
        <code>https://www.googleapis.com/auth/userinfo.email</code>.
      </p>
      <p>Folosim aceste date exclusiv pentru:</p>
      <ul>
        <li>crearea unui eveniment în calendar la confirmarea unei programări;</li>
        <li>ștergerea sau actualizarea evenimentului la anulare/reprogramare;</li>
        <li>
          citirea intervalelor ocupate (free/busy) pentru a ascunde sloturile
          deja blocate în Google Calendar pe pagina publică de programări;
        </li>
        <li>afișarea adresei Gmail conectate în profilul frizerului.</li>
      </ul>
      <p>
        <strong>Nu</strong> vindem date Google, nu le folosim pentru publicitate
        și nu le transferăm către brokeri de date. Respectăm{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        . Detalii:{" "}
        <a href="/google-calendar-data">Utilizarea datelor Google Calendar</a>.
      </p>
      <p>
        Token-urile OAuth sunt stocate securizat și asociate contului frizerului.
        Frizerul poate revoca accesul din{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          contul Google → Permisiuni
        </a>
        .
      </p>

      <h3>3.5. Date tehnice</h3>
      <ul>
        <li>Cookie-uri de sesiune (autentificare)</li>
        <li>Loguri tehnice, adrese IP (limitat, securitate)</li>
      </ul>

      <h2>4. Temeiuri legale (GDPR)</h2>
      <ul>
        <li>
          <strong>Executarea contractului</strong> — furnizarea serviciului
          Frizeo și gestionarea programărilor
        </li>
        <li>
          <strong>Interes legitim</strong> — securitate, prevenire abuz,
          îmbunătățire serviciu
        </li>
        <li>
          <strong>Consimțământ</strong> — cookie-uri de marketing/analytics
          (Meta Pixel, TikTok Pixel, Google Analytics), doar dacă le accepți în banner
        </li>
        <li>
          <strong>Obligație legală</strong> — contabilitate, fiscalitate, când
          aplicabil
        </li>
      </ul>

      <h2>5. Destinatari / împuterniciți</h2>
      <p>Datele pot fi procesate de furnizori care ne ajută să operăm platforma:</p>
      <ul>
        <li>Supabase (bază de date, autentificare) — UE</li>
        <li>Vercel (hosting aplicație)</li>
        <li>Zoho / furnizor email (notificări email)</li>
        <li>SMSO (notificări SMS, planuri plătite / trial)</li>
        <li>Google (Calendar OAuth, dacă este conectat; Analytics 4, cu consimțământ)</li>
        <li>Meta Platforms (Pixel conversii reclame, cu consimțământ)</li>
        <li>TikTok (Pixel conversii reclame, cu consimțământ)</li>
        <li>Stripe (procesare plăți abonament, UE/global) —{" "}
        <a
          href="https://stripe.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          politica Stripe
        </a>
        </li>
      </ul>
      <p>
        Saloanele care folosesc Frizeo pot fi operatori independenți față de
        clienții lor finali. Frizeo acționează ca împuternicit pentru datele
        clienților introduse în programări, în numele salonului.
      </p>

      <h2>6. Perioada de stocare</h2>
      <ul>
        <li>Cont activ: pe durata utilizării serviciului</li>
        <li>Programări: până la 24 luni după data programării (sau mai mult dacă legea impune)</li>
        <li>
          Date de facturare și documente fiscale: conform obligațiilor legale
          (de regulă 10 ani de la emitere)
        </li>
        <li>Cont șters: date șterse sau anonimizate în 90 zile, exceptând obligații legale și arhiva fiscală</li>
      </ul>

      <h2>7. Drepturile tale</h2>
      <p>Conform GDPR, ai dreptul la:</p>
      <ul>
        <li>Acces, rectificare, ștergere</li>
        <li>Restricționare și opoziție</li>
        <li>Portabilitate (unde e aplicabil)</li>
        <li>Retragerea consimțământului</li>
        <li>Plângere la ANSPDCP (www.dataprotection.ro)</li>
      </ul>
      <p>
        Solicitări:{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>. Răspundem în
        maximum 30 de zile.
      </p>

      <h2>8. Securitate</h2>
      <p>
        Aplicăm măsuri tehnice și organizatorice rezonabile: conexiuni
        criptate (HTTPS), parole hash-uite, acces restricționat la date.
      </p>

      <h2>9. Modificări</h2>
      <p>
        Putem actualiza această politică. Versiunea curentă este publicată pe{" "}
        {c.website}/privacy.
      </p>
    </LegalPageLayout>
  );
}
