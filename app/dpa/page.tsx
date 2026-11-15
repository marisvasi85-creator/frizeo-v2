import LegalPageLayout from "@/app/components/LegalPageLayout";
import { DPA_CANONICAL_TEXT, DPA_DRAFT_VERSION, dpaDocumentHash } from "@/lib/dpa/document";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Acord de prelucrare",
  description:
    "Proiectul Frizeo pentru clauzele dintre salon și persoană împuternicită, după art. 28 GDPR și Decizia (UE) 2021/915.",
  path: "/dpa",
});

function renderLine(line: string, index: number) {
  if (line.startsWith("## ")) {
    return <h3 key={index}>{line.slice(3)}</h3>;
  }
  if (line.startsWith("# ")) {
    return <h2 key={index}>{line.slice(2)}</h2>;
  }
  if (line.startsWith("- ")) {
    return <li key={index}>{line.slice(2)}</li>;
  }
  if (line.trim() === "") return null;
  return <p key={index}>{line}</p>;
}

export default function DpaPage() {
  const hash = dpaDocumentHash();
  const lines = DPA_CANONICAL_TEXT.split("\n");

  return (
    <LegalPageLayout title="Acord de prelucrare" path="/dpa">
      <p className="text-sm text-gray-500 mb-8">
        Versiune: {DPA_DRAFT_VERSION}
        <br />
        SHA-256: {hash}
      </p>
      <p>
        Pagina este publică. Proiectul nu este semnat și nu blochează conturile.
        Acceptarea nu este înregistrată de aici.
      </p>
      {lines.map(renderLine)}
      <h2>Textul folosit pentru hash</h2>
      <pre className="whitespace-pre-wrap text-sm">{DPA_CANONICAL_TEXT}</pre>
    </LegalPageLayout>
  );
}
