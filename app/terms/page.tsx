import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";

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
      <p>
        <strong>Plată:</strong> planurile Pro și Pro+ sunt cu abonament lunar.
        Poți anula oricând din cont.
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
        <li>Poți înceta utilizarea oricând</li>
        <li>Putem suspenda contul la abuz sau neplată</li>
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
