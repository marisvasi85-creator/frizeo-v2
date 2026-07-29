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

const PATH = "/programari-online-frizerie";

export const metadata = createPageMetadata({
  title: "Programări online pentru frizerie",
  description:
    "Cum funcționează programările online pentru frizerii și barbershop-uri din România: link personal, calendar, reminder-e și prețuri clare cu Frizeo.",
  path: PATH,
  keywords: [
    "programări online frizerie",
    "programare frizer online România",
    "sistem programări barbershop",
    "link programări frizerie",
  ],
});

export default function ProgramariOnlineFrizeriePage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Programări online frizerie", path: PATH },
          ]),
          webPageJsonLd({
            name: "Programări online pentru frizerie — Frizeo",
            description:
              "Ghid scurt: de ce frizeriile din România aleg programări online cu link personal, calendar și reminder-e.",
            path: PATH,
          })
        )}
      />
      <ContentShell
        title="Programări online pentru frizerie"
        lead="Clienții aleg singuri serviciul, ziua și ora. Tu vezi totul în calendar — fără să întrerupi tunsul pentru fiecare apel."
        cta={{ href: "/signup", label: "Creează cont gratuit" }}
        secondaryCta={{ href: "/pricing", label: "Vezi prețurile" }}
      >
        <ContentSection title="Ce înseamnă programări online într-o frizerie">
          <p>
            În loc să notezi pe hârtie, în Instagram DM sau pe telefon, dai
            clientului un link. El rezervă când îi e comod; tu primești
            programarea în Frizeo, cu confirmări și reminder-e pe email (și SMS
            reminder pe planurile Pro / Pro+ / trial).
          </p>
        </ContentSection>

        <ContentSection title="Pentru cine e potrivit">
          <ContentList
            items={[
              "Frizer independent care vrea un link de booking în bio",
              "Salon / barbershop cu 2–3 frizeri (plan Pro+)",
              "Echipe care vor mai puține no-show-uri prin reminder automat",
            ]}
          />
        </ContentSection>

        <ContentSection title="Cum arată fluxul">
          <ContentList
            items={[
              "Configurezi serviciile, duratele și programul",
              "Distribui link-ul (Instagram, WhatsApp, Google, afiș)",
              "Clientul rezervă; tu confirmi din calendar",
              "Reminder-ele pleacă automat, după setările tale și plan",
            ]}
          />
        </ContentSection>

        <ContentSection title="Prețuri, pe scurt">
          <p>
            {LEGAL_PRICING.trialNote} Free rămâne disponibil după trial (80
            programări / lună). Pro de la 79 lei/lună, Pro+ de la 199 lei/lună.
            Fără comision pe programări.
          </p>
          <p>
            Detalii complete pe pagina de{" "}
            <Link
              href="/pricing"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              prețuri
            </Link>
            . Răspunsuri la întrebări frecvente:{" "}
            <Link
              href="/faq"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              FAQ Frizeo
            </Link>
            .
          </p>
        </ContentSection>

        <ContentSection title="Pași practici">
          <p>
            Dacă vrei să pui link-ul în social media, vezi ghidurile:{" "}
            <Link
              href="/ghid/link-programari-instagram"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              Instagram
            </Link>{" "}
            și{" "}
            <Link
              href="/ghid/programari-whatsapp"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              WhatsApp
            </Link>
            . Comparație cu programările pe telefon:{" "}
            <Link
              href="/frizeo-vs-programari-pe-telefon"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              Frizeo vs. telefon
            </Link>
            .
          </p>
        </ContentSection>
      </ContentShell>
    </>
  );
}
