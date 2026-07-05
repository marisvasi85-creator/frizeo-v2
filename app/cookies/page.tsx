import LegalPageLayout from "@/app/components/LegalPageLayout";
import CookiePreferencesButton from "@/app/components/CookiePreferencesButton";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Politica cookies",
  description:
    "Ce cookie-uri și stocare locală folosește Frizeo, inclusiv sesiune, Stripe Checkout și Google Calendar.",
  path: "/cookies",
});

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

      <h3>Cookie-uri ne-esențiale (cu consimțământ)</h3>
      <p>
        Dacă accepți bannerul de cookies, putem folosi:
      </p>
      <ul>
        <li>
          <strong>Meta Pixel</strong> — măsurare conversii din reclame Facebook /
          Instagram (Meta Platforms Ireland Ltd.)
        </li>
        <li>
          <strong>TikTok Pixel</strong> — măsurare conversii din reclame TikTok
          (TikTok Technology Limited)
        </li>
        <li>
          <strong>Google Analytics 4</strong> — statistici anonime de trafic
          (Google Ireland Ltd.)
        </li>
      </ul>
      <p>
        Aceste cookie-uri se activează <strong>doar după consimțământ</strong>.
        Poți refuza cu „Doar esențiale” — site-ul funcționează normal fără ele.
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
        <li>
          Poți reseta preferința din site cu butonul{" "}
          <CookiePreferencesButton label="Preferințe cookies" /> — bannerul
          reapare și poți alege din nou
        </li>
      </ul>

      <h2>5. Cookie-uri terțe — Google OAuth</h2>
      <p>
        La conectarea Google Calendar (opțional, din contul admin), ești
        redirecționat către Google, care poate seta propriile cookie-uri conform
        politicii Google. Frizeo accesează Calendar doar conform{" "}
        <a href="/google-calendar-data">Utilizarea datelor Google Calendar</a>.
      </p>

      <h2>6. Cookie-uri terțe — Stripe</h2>
      <p>
        La activarea unui plan plătit, ești redirecționat către{" "}
        <strong>Stripe Checkout</strong> (stripe.com). Stripe poate seta
        cookie-uri proprii pe domeniul lor, necesare pentru procesarea plății și
        securitate. Detalii:{" "}
        <a
          href="https://stripe.com/cookie-settings"
          target="_blank"
          rel="noopener noreferrer"
        >
          stripe.com/cookie-settings
        </a>
        .
      </p>

      <h2>7. Contact</h2>
      <p>
        Întrebări:{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
    </LegalPageLayout>
  );
}
