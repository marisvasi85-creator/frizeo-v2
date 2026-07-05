import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Termeni și condiții",
  description:
    "Termenii de utilizare Frizeo: planuri, plată Stripe, obligații salon, anulare abonament și lege aplicabilă.",
  path: "/terms",
});

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
        {c.website}), operată de <strong>{c.name}</strong>, CUI {c.cui}, {c.address}
        („Frizeo”, „noi”). Utilizatorul („Salonul”, „tu”) este persoana
        juridică sau fizică autorizată care creează cont și folosește serviciul.
      </p>

      <h2>2. Serviciul</h2>
      <p>
        Frizeo oferă o platformă online de programări: calendar, servicii,
        link public, notificări email/SMS (conform planului), gestionare
        frizeri, program de lucru și zile speciale.
      </p>
      <p>
        Platforma este destinată în principal frizeriilor, barbershop-urilor și
        saloanelor din <strong>România</strong>, precum și clienților finali
        care se programează la aceste unități. Documentația contractuală este în
        limba română; prețurile sunt în lei (RON).
      </p>

      <h3>2.1. Google Calendar (opțional)</h3>
      <p>
        Frizerul poate conecta opțional Google Calendar pentru sincronizarea
        programărilor. Utilizarea datelor Google este descrisă în{" "}
        <a href="/google-calendar-data">Utilizarea datelor Google Calendar</a>{" "}
        și în Politica de confidențialitate. Conectarea necesită acțiune
        explicită din Profil; Frizeo funcționează și fără această integrare.
      </p>

      <h2>3. Cont și eligibilitate</h2>
      <ul>
        <li>Trebuie să ai minimum 18 ani și capacitate legală</li>
        <li>Datele furnizate trebuie să fie corecte și actualizate</li>
        <li>Ești responsabil pentru securitatea contului tău</li>
        <li>Un cont per salon; partajarea credențialelor se face pe propria răspundere</li>
      </ul>

      <h2>4. Planuri și prețuri</h2>
      <p>Planurile disponibile la data actualizării:</p>
      <ul>
        {LEGAL_PRICING.plans.map((p) => (
          <li key={p.name}>
            <strong>{p.name}</strong> — {p.price}
            {p.priceNote ?? ""}, {p.barbers}, {p.bookings}
            {p.sms ? ", SMS inclus" : ", fără SMS"}
          </li>
        ))}
      </ul>
      <p>
        <strong>Trial:</strong> {LEGAL_PRICING.trialDays} zile cu acces Pro+
        (inclusiv SMS), gratuit. După trial, contul trece automat pe planul
        Free, dacă nu activezi un plan plătit.
      </p>

      <h3>4.1. Plata abonamentului (Stripe)</h3>
      <p>
        Planurile <strong>Pro</strong> și <strong>Pro+</strong> sunt cu
        abonament <strong>lunar</strong>, plătit prin{" "}
        <strong>Stripe</strong> (procesator de plăți). La activare ești
        redirecționat în Stripe Checkout, unde completezi datele de facturare
        (persoană fizică sau juridică, adresă, CUI dacă e cazul) și metoda de
        plată. Frizeo nu stochează numărul complet al cardului.
      </p>
      <ul>
        <li>
          <strong>Reînnoire automată:</strong> abonamentul se reînnoiește lunar
          până la anulare
        </li>
        <li>
          <strong>Upgrade:</strong> poți trece la un plan superior din secțiunea
          Abonament (ex. Pro → Pro+); diferența de preț poate fi facturată
          proporțional (proratare)
        </li>
        <li>
          <strong>Downgrade:</strong> după ce ai avut un abonament plătit activ,
          trecerea la un plan inferior (ex. Pro+ → Pro) nu este disponibilă
          direct din platformă — contactează-ne la{" "}
          <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>
        </li>
        <li>
          <strong>Plată eșuată:</strong> dacă o plată lunară eșuează, statusul
          abonamentului poate deveni „restanță”; vei fi notificat în cont și
          poți finaliza plata prin linkul Stripe afișat acolo
        </li>
        <li>
          <strong>Factură fiscală:</strong> după confirmarea plății, Frizeo
          emite factura fiscală (prin SmartBill sau sistem echivalent), pe baza
          datelor de facturare din cont
        </li>
        <li>
          Prețurile afișate sunt în lei (RON); TVA se aplică conform legislației
          în vigoare, dacă este cazul
        </li>
      </ul>

      <h3>4.2. Anularea abonamentului plătit</h3>
      <p>
        Poți solicita anularea abonamentului plătit oricând, scriind la{" "}
        <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>. Anularea
        produce efect de obicei la sfârșitul perioadei curente de facturare,
        conform regulilor Stripe și ale abonamentului tău. Până atunci, accesul
        la funcțiile planului plătit rămâne activ dacă plata este în regulă.
      </p>
      <p>
        Oprirea plății sau anularea checkout-ului în Stripe, înainte de
        finalizare, nu activează abonamentul.
      </p>

      <p>
        <strong>SMS:</strong> disponibil doar pe planuri plătite și în perioada
        de trial. Planul Free nu include SMS.
      </p>
      <p>
        <strong>Custom:</strong> plan personalizat, activat manual după
        contact la{" "}
        <a href={`mailto:${c.billingEmail}`}>{c.billingEmail}</a>.
      </p>
      <p>
        Plățile pentru planul Custom se stabilesc individual și pot fi
        procesate prin factură sau altă metodă agreată.
      </p>

      <h2>5. Obligațiile Salonului</h2>
      <ul>
        <li>Respecți programul afișat clienților</li>
        <li>Prelucrezi datele clienților finali conform GDPR</li>
        <li>Nu folosești platforma în scopuri ilegale sau abuzive</li>
        <li>Ești responsabil pentru conținutul publicat (logo, texte, servicii)</li>
      </ul>

      <h2>6. Obligațiile Frizeo</h2>
      <ul>
        <li>Facilităm accesul la platformă cu diligență rezonabilă</li>
        <li>Putem efectua mentenanță programată (cu notificare când e posibil)</li>
        <li>Nu garantăm funcționare neîntreruptă 100%</li>
      </ul>

      <h2>7. Proprietate intelectuală</h2>
      <p>
        Platforma, codul, designul și marca Frizeo ne aparțin. Ție îți aparțin
        datele și conținutul pe care îl încarci.
      </p>

      <h2>8. Limitarea răspunderii</h2>
      <p>
        Frizeo nu răspunde pentru pierderi indirecte, pierderi de profit sau
        programări ratate din cauze externe (internet, SMS, email terți).
        Răspunderea totală este limitată la sumele plătite în ultimele 12 luni
        pentru serviciu, când legea permite.
      </p>

      <h2>9. Reziliere</h2>
      <ul>
        <li>Poți înceta utilizarea platformei oricând</li>
        <li>
          Abonamentul plătit se anulează la cerere, conform secțiunii 4.2
        </li>
        <li>
          Putem suspenda sau restricționa contul la abuz, neplată prelungită sau
          încălcarea termenilor
        </li>
        <li>La ștergere, datele sunt tratate conform Politicii de confidențialitate</li>
      </ul>

      <h2>10. Modificări</h2>
      <p>
        Putem modifica termenii. Modificările semnificative vor fi comunicate pe
        email sau în platformă. Continuarea utilizării după modificare
        constituie accept.
      </p>

      <h2>11. Lege aplicabilă</h2>
      <p>
        Termenii sunt guvernați de legea română. Litigiile se soluționează
        amiabil; în lipsa acordului, de instanțele competente din România.
      </p>

      <h2>12. Contact</h2>
      <p>
        <a href={`mailto:${c.email}`}>{c.email}</a>
        <br />
        {c.name}, {c.address}
      </p>
    </LegalPageLayout>
  );
}
