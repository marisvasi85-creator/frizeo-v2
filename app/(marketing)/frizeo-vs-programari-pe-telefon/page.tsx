import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import ContentShell, {
  ContentList,
  ContentSection,
} from "@/app/(marketing)/components/ContentShell";
import { LEGAL_PRICING } from "@/lib/legal/company";
import {
  breadcrumbJsonLd,
  jsonLdGraph,
  webPageJsonLd,
} from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

const PATH = "/frizeo-vs-programari-pe-telefon";

export const metadata = createPageMetadata({
  title: "Frizeo vs. programări pe telefon",
  description:
    "Când merită un link de programări online față de telefon, hârtie sau DM-uri — fără hype, pentru frizerii din România.",
  path: PATH,
  keywords: [
    "programări online vs telefon",
    "sistem programări frizerie",
    "alternativă programări telefon frizer",
  ],
});

export default function ComparisonPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Frizeo vs. telefon", path: PATH },
          ]),
          webPageJsonLd({
            name: "Frizeo vs. programări pe telefon",
            description:
              "Comparație practică între programările pe telefon/hârtie și un link Frizeo pentru frizerii din România.",
            path: PATH,
          })
        )}
      />
      <ContentShell
        title="Frizeo vs. programări pe telefon"
        lead="Telefonul nu dispare. Ideea e să nu mai fii tu agenda pentru fiecare oră. Mai jos — diferențe reale, fără promisiuni exagerate."
        cta={{ href: "/signup", label: `Încearcă ${LEGAL_PRICING.trialDays} zile` }}
        secondaryCta={{ href: "/pricing", label: "Vezi prețurile" }}
      >
        <ContentSection title="Ce rămâne greu pe telefon">
          <ContentList
            items={[
              "Ești întrerupt în timpul tunsului",
              "Două persoane pot primi „da” pe același interval",
              "Nu există reminder automat — no-show-urile apar mai des",
              "Agenda pe hârtie / Excel e greu de partajat în echipă",
            ]}
          />
        </ContentSection>

        <ContentSection title="Ce schimbă un link Frizeo">
          <ContentList
            items={[
              "Clientul vede doar orele libere",
              "Programarea intră în calendarul tău",
              "Confirmări pe email; SMS reminder pe Pro / Pro+ / trial",
              "Marketing AI: postări și oferte cu același link de booking",
              "Pe Pro+: până la 3 frizeri, cu invitații în limita locurilor",
            ]}
          />
        </ContentSection>

        <ContentSection title="Când telefonul tot are sens">
          <p>
            Pentru clienți care nu se descurcă online, pentru urgențe sau pentru
            programări speciale — poți continua să răspunzi. Frizeo nu înlocuiește
            relația; reduce volumul de „mai ai loc?” repetat.
          </p>
        </ContentSection>

        <ContentSection title="Cost, pe scurt">
          <p>
            Poți începe cu trial ({LEGAL_PRICING.trialDays} zile) sau Free (80
            programări / lună). Pro de la 79 lei/lună. Fără comision pe
            programare. Detalii:{" "}
            <Link
              href="/pricing"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              prețuri
            </Link>
            . Întrebări:{" "}
            <Link
              href="/faq"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              FAQ
            </Link>
            .
          </p>
        </ContentSection>

        <ContentSection title="Pași următori">
          <p>
            Citește{" "}
            <Link
              href="/programari-online-frizerie"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              programări online pentru frizerie
            </Link>{" "}
            sau pune link-ul în{" "}
            <Link
              href="/ghid/link-programari-instagram"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              Instagram
            </Link>{" "}
            /{" "}
            <Link
              href="/ghid/programari-whatsapp"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              WhatsApp
            </Link>
            .
          </p>
        </ContentSection>
      </ContentShell>
    </>
  );
}
