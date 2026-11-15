import LegalPageLayout from "@/app/components/LegalPageLayout";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Ștergerea datelor din integrări",
  description:
    "Cum deconectezi Facebook, Instagram, TikTok și Google Business Profile din Frizeo și ce date se șterg.",
  path: "/stergere-date",
});

export default function IntegrationDataDeletionPage() {
  const c = LEGAL_COMPANY;

  return (
    <LegalPageLayout title="Ștergerea datelor din integrări" path="/stergere-date">
      <p className="text-sm text-gray-500 mb-8">
        Ultima actualizare: {c.lastUpdated}
      </p>

      <h2>1. Ce poți face din Frizeo</h2>
      <p>
        Ownerul sau managerul salonului poate deconecta o integrare din{" "}
        <a href="/admin/settings/integrations">Integrări</a>. Pagina cere
        autentificare. Instrucțiunile de pe această pagină sunt publice.
      </p>
      <ul>
        <li>Facebook și Instagram: deconectare Meta;</li>
        <li>TikTok: deconectare TikTok;</li>
        <li>Google Business Profile: deconectare Google Business;</li>
        <li>
          Google Calendar, separat: din Profil, „Deconectează Google Calendar”.
        </li>
      </ul>
      <p>
        La deconectarea Meta, TikTok sau Google Business Profile, Frizeo șterge
        conexiunea salonului, tokenul criptat, destinațiile salvate (pagini,
        cont Instagram, cont TikTok sau locație) și rândurile de publicare
        legate de ele.
      </p>

      <h2>2. Ce nu se șterge automat</h2>
      <ul>
        <li>
          postarea deja trimisă rămâne pe Facebook, Instagram, TikTok sau
          Google, după regulile acelei platforme;
        </li>
        <li>
          textul păstrat într-o campanie Frizeo și fișierul din spațiul privat
          de publicare rămân până când operatorul setează{" "}
          <code>MARKETING_DATA_RETENTION_DAYS</code>; numărul de zile nu este
          ales în acest document și, nesetat, nu șterge nimic;
        </li>
        <li>
          ștergerea contului unui utilizator nu deconectează integrările
          salonului și nu șterge programările sau documentele fiscale.
        </li>
      </ul>
      <p>
        Pentru ștergerea acestor rămășițe, scrie la{" "}
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a> din adresa
        contului și spune salonul și integrarea. Nu există în aplicație un
        termen automat pentru acest pas.
      </p>

      <h2>3. Cererea semnată de Meta</h2>
      <p>
        Meta poate trimite o cerere semnată când utilizatorul scoate aplicația
        Frizeo sau cere ștergerea datelor. Frizeo verifică semnătura cu secretul
        aplicației. Dacă semnătura este validă, sunt închise doar conexiunile
        Meta ale acelui cont Facebook, inclusiv tokenul, paginile, conturile
        Instagram și joburile legate. O semnătură invalidă nu șterge nimic.
      </p>
      <p>
        Pentru ștergerea datelor, Meta primește un cod și o pagină de stare.
        Pagina nu arată salonul și nu spune câte conexiuni existau. Postările
        deja publicate pe Facebook sau Instagram rămân la Meta. TikTok, Google
        Business Profile, programările și facturile nu sunt incluse.
      </p>

      <h2>4. Retragerea accesului pe platformă</h2>
      <ul>
        <li>
          Meta: setările Facebook sau Instagram pentru aplicații și site-uri,
          apoi elimină Frizeo;
        </li>
        <li>
          TikTok: setările de securitate ale contului, la aplicațiile conectate;
        </li>
        <li>
          Google:{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          , aplicația Frizeo.
        </li>
      </ul>
      <p>
        Revocarea pe platformă oprește accesul viitor. Ea nu șterge singură,
        din Frizeo, tokenul deja salvat. Pentru asta folosește și deconectarea
        din Integrări sau cererea pe email.
      </p>

      <h2>5. Ștergerea contului Frizeo</h2>
      <p>
        Din Cont poți cere ștergerea utilizatorului. Există un răgaz în care
        cererea poate fi anulată, apoi finalizarea. La finalizare se șterg
        tokenurile Google Calendar ale frizerului. Nu se șterg evenimentele
        deja create în calendarul Google.
      </p>
      <p>
        Detaliile despre cont, programări și facturi rămân cele din{" "}
        <a href="/privacy">Politica de confidențialitate</a>.
      </p>

      <h2>6. Contact</h2>
      <p>
        <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
      <p>
        Telefon / WhatsApp Business:{" "}
        <a href={`tel:${c.phoneE164}`}>{c.phone}</a>
      </p>

      <hr className="my-10 border-gray-200" />

      <h2>English summary for platform reviewers</h2>
      <p>
        This public page explains how a Frizeo salon removes Facebook,
        Instagram, TikTok, and Google Business Profile data. No login is
        required to read it.
      </p>
      <p>
        An owner or manager disconnects the integration in Frizeo settings.
        That deletes the salon connection, the encrypted token, the saved
        page, Instagram account, TikTok account, or Business Profile location,
        and the publish-history rows linked to them.
      </p>
      <p>
        A post already sent stays on that platform. Leftover campaign text
        and private media files are deleted only after the operator sets
        MARKETING_DATA_RETENTION_DAYS. No number is chosen here; while it is
        unset, nothing is deleted automatically. Active connections, publish
        jobs, bookings, and invoices are outside that job. Deleting one
        Frizeo user does not by itself disconnect the salon’s integration.
        Those leftovers can be requested at {c.privacyEmail}. Google Calendar
        tokens are removed when the Frizeo user deletion completes. Existing
        Google Calendar events are not deleted.
      </p>
      <p>
        People can also remove Frizeo from their Facebook, Instagram, TikTok,
        or Google account permissions. That stops future access. They should
        also disconnect inside Frizeo, or email us, to delete a token already
        stored.
      </p>
      <p>
        Meta’s signed deauthorize and data-deletion callbacks remove only the
        Meta connection for the Facebook user in the signed request. An
        invalid signature deletes nothing. The data-deletion response includes
        a confirmation code and a status URL. The status page does not show
        the salon or how many connections existed.
      </p>
    </LegalPageLayout>
  );
}
