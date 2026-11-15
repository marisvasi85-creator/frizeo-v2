import LegalPageLayout from "@/app/components/LegalPageLayout";
import DpaText from "@/app/dpa/DpaText";
import { DPA_CANONICAL_TEXT, DPA_VERSION, DPA_VERSION_DATE, dpaDocumentHash } from "@/lib/dpa/document";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import Link from "next/link";

export const metadata = createPageMetadata({
  title: "Acord de prelucrare",
  description:
    "Acordul Frizeo pentru prelucrarea datelor în numele salonului, după art. 28 GDPR.",
  path: "/dpa",
});

export default function DpaPage() {
  const hash = dpaDocumentHash();

  return (
    <LegalPageLayout title="Acord de prelucrare" path="/dpa">
      <p className="text-sm text-gray-500 mb-8 break-all">
        Versiune: {DPA_VERSION}
        <br />
        Data: {DPA_VERSION_DATE}
        <br />
        SHA-256: {hash}
      </p>
      <DpaText text={DPA_CANONICAL_TEXT} />
      <p>
        Textul acestei versiuni rămâne disponibil la{" "}
        <Link href={`/dpa/v/${DPA_VERSION}`}>/dpa/v/{DPA_VERSION}</Link>.
      </p>
    </LegalPageLayout>
  );
}
