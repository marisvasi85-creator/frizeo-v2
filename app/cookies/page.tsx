import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY } from "@/lib/legal/company";

export default function CookiesPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Politica cookies">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Ce sunt cookie-urile</h2>
      <p>
        Cookie-urile sunt fișiere mici stocate în browserul tău. Ne ajută să
        menținem sesiunea de autentificare și funcționarea platformei Frizeo.
      </p>

      <h2>2. Ce cookie-uri folosim</h2>

      <h3>Cookie-uri esențiale (obligatorii)</h3>
      <p>
        Necesare pentru login, securitate și navigare în contul de admin. Fără
        ele, platforma nu funcționează corect.
      </p>
      <ul>
        <li>
          <strong>Sesiune Supabase Auth</strong> — autentificare utilizator
        </li>
        <li>
          <strong>tenant_id</strong> — salonul activ selectat (conturi multi-salon)
        </li>
      </ul>

      <h3>Cookie-uri ne-esențiale</h3>
      <p>
        În prezent <strong>nu folosim</strong> cookie-uri de analytics (Google
        Analytics, Meta Pixel etc.). Dacă le vom introduce, vom actualiza această
        pagină și vom cere consimțământul tău.
      </p>

      <h2>3. Stocare locală (localStorage)</h2>
      <p>
        Bannerul de cookies salvează preferința ta în localStorage sub cheia{" "}
        <code>frizeo_cookie_consent</code> — nu este un cookie, dar are rol
        similar (reține dacă ai acceptat).
      </p>

      <h2>4. Cum controlezi cookie-urile</h2>
      <ul>
        <li>Poți șterge cookie-urile din setările browserului</li>
        <li>Poți bloca cookie-urile — dar nu vei putea folosi contul admin</li>
        <li>Bannerul de pe site îți permite să accepți sau să folosești doar esențiale</li>
      </ul>

      <h2>5. Cookie-uri terțe</h2>
      <p>
        La conectarea Google Calendar, ești redirecționat către Google, care
        poate seta propriile cookie-uri conform politicii Google.
      </p>

      <h2>6. Contact</h2>
      <p>
        Întrebări:{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
    </LegalPageLayout>
  );
}
