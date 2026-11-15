import LegalPageLayout from "@/app/components/LegalPageLayout";
import { metaDeletionStatus } from "@/lib/integrations/meta/signedRequest";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Starea ștergerii Meta",
  description: "Confirmarea unei cereri de ștergere primite de la Meta pentru o conexiune Frizeo.",
  path: "/stergere-date",
});

export default async function MetaDeletionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const status = metaDeletionStatus(code, process.env.META_APP_SECRET ?? "");
  const c = LEGAL_COMPANY;
  const issued = status.ok
    ? new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Bucharest",
    }).format(new Date(status.issuedAt * 1000))
    : null;

  return (
    <LegalPageLayout title="Starea ștergerii Meta" path="/stergere-date">
      {issued ? (
        <>
          <p>
            Cererea semnată de Meta a fost primită la {issued} (ora României).
            Conexiunile Meta din Frizeo pentru contul Facebook care a semnat
            cererea au fost închise, dacă existau.
          </p>
          <p>
            Tokenul, paginile și conturile Instagram salvate pentru acel cont
            Facebook sunt șterse odată cu conexiunea. Postările deja publicate
            pe Facebook sau Instagram rămân acolo. TikTok, Google Business
            Profile, programările și documentele fiscale nu sunt atinse.
          </p>
        </>
      ) : (
        <p>Codul de confirmare nu este valid sau a expirat.</p>
      )}
      <p>
        Întrebări: <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
      </p>
    </LegalPageLayout>
  );
}
