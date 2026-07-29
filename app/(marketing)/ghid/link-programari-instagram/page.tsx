import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import ContentShell, {
  ContentList,
  ContentSection,
} from "@/app/(marketing)/components/ContentShell";
import {
  breadcrumbJsonLd,
  howToJsonLd,
  jsonLdGraph,
} from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

const PATH = "/ghid/link-programari-instagram";

const STEPS = [
  {
    name: "Creează contul și serviciile",
    text: "În Frizeo adaugi serviciile (tuns, fade, barbă), duratele și programul tău.",
  },
  {
    name: "Copiază link-ul de programări",
    text: "Din admin iei link-ul public al paginii tale de booking (sau al salonului).",
  },
  {
    name: "Pune link-ul în bio Instagram",
    text: "În Edit profile → Website / Link, lipești URL-ul Frizeo. Opțional: un link-in-bio cu eticheta „Programează-te”.",
  },
  {
    name: "Menționează-l în stories și postări",
    text: "Adaugi sticker de link în stories sau scrii în caption: „Programări din link-ul din bio”.",
  },
];

export const metadata = createPageMetadata({
  title: "Link de programări pe Instagram",
  description:
    "Cum pui link-ul Frizeo în bio-ul de Instagram ca frizerii și barbershop-urile să primească programări fără DM-uri.",
  path: PATH,
  keywords: [
    "link programări Instagram frizerie",
    "bio Instagram programări",
    "booking link barbershop",
  ],
});

export default function InstagramGuidePage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Ghiduri", path: "/ghid" },
            { name: "Link Instagram", path: PATH },
          ]),
          howToJsonLd({
            name: "Cum pui link-ul de programări Frizeo pe Instagram",
            description:
              "Pași pentru frizeri: de la cont Frizeo până la link în bio și stories.",
            path: PATH,
            steps: STEPS,
          })
        )}
      />
      <ContentShell
        title="Link de programări pe Instagram"
        lead="DM-urile pentru „mai ai loc mâine?” mănâncă timp. Un link în bio mută rezervarea pe pagina ta Frizeo."
        cta={{ href: "/signup", label: "Creează cont gratuit" }}
        secondaryCta={{ href: "/ghid", label: "Toate ghidurile" }}
      >
        <ContentSection title="De ce merită">
          <p>
            Clienții rezervă când văd un story sau un reel — nu când tu poți
            răspunde la telefon. Link-ul din bio e cel mai simplu canal de
            programări online pentru frizerii din România.
          </p>
        </ContentSection>

        <ContentSection title="Pași">
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm sm:text-base">
            {STEPS.map((step) => (
              <li key={step.name}>
                <span className="font-semibold text-[var(--mkt-ink)]">
                  {step.name}.
                </span>{" "}
                {step.text}
              </li>
            ))}
          </ol>
        </ContentSection>

        <ContentSection title="Texte scurte pe care le poți copia">
          <ContentList
            items={[
              "Programări online din link-ul din bio.",
              "Alege serviciul și ora — fără să mă suni în timpul tunsului.",
              "Locuri limitate săptămâna asta → link în bio.",
            ]}
          />
        </ContentSection>

        <ContentSection title="În plus">
          <p>
            Același link merge pe{" "}
            <Link
              href="/ghid/programari-whatsapp"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              WhatsApp
            </Link>
            , Google Business Profile sau afiș în salon. Întrebări despre
            prețuri și SMS:{" "}
            <Link
              href="/faq"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              FAQ
            </Link>
            .
          </p>
        </ContentSection>
      </ContentShell>
    </>
  );
}
