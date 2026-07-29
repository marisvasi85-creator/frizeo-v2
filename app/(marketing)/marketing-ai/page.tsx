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

const PATH = "/marketing-ai";

export const metadata = createPageMetadata({
  title: "Marketing AI pentru frizerii",
  description:
    "Marketing AI în Frizeo: postări Instagram, story, Reel și oferte generate pe serviciile salonului tău, cu link de programări — inclus în Free, Pro și Pro+.",
  path: PATH,
  keywords: [
    "marketing ai frizerie",
    "postări Instagram barbershop",
    "conținut social media frizer",
    "promoții salon AI",
  ],
});

export default function MarketingAiPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Marketing AI", path: PATH },
          ]),
          webPageJsonLd({
            name: "Marketing AI pentru frizerii — Frizeo",
            description:
              "Generezi conținut de promovare pentru Instagram din același loc din care gestionezi programările.",
            path: PATH,
          })
        )}
      />
      <ContentShell
        title="Marketing AI pentru frizerii"
        lead="Programările aduc clienții care te știu deja. Marketing AI te ajută să umpli scaunul și cu oameni noi — fără să stai ore pe caption-uri."
        cta={{ href: "/signup", label: "Încearcă Marketing AI" }}
        secondaryCta={{ href: "/pricing", label: "Vezi prețurile" }}
      >
        <ContentSection title="Ce face, concret">
          <ContentList
            items={[
              "Postări Instagram și story-uri pe tonul tău (relaxat, premium sau street)",
              "Scripturi pentru Reel, gata de filmat",
              "Oferte pe serviciu, birthday și campanii sezoniere",
              "Card vizual descărcabil cu brandul salonului",
              "CTA cu link-ul tău de programări Frizeo",
            ]}
          />
        </ContentSection>

        <ContentSection title="De ce e un atu, nu un add-on">
          <p>
            Majoritatea tool-urilor de booking se opresc la calendar. Frizeo
            leagă rezervarea de promovare: același salon, aceleași servicii,
            același link. Nu plătești un al doilea abonament de „AI content”
            ca să anunți că ai locuri libere.
          </p>
        </ContentSection>

        <ContentSection title="Limite pe plan">
          <ContentList
            items={[
              "Free — 3 generări / zi",
              "Pro — 20 generări / zi",
              "Pro+ — 50 generări / zi",
              `Trial (${LEGAL_PRICING.trialDays} zile) — până la 50 generări / zi`,
              "Custom — limite personalizate",
            ]}
          />
          <p className="mt-3">
            Limitele se resetează zilnic. Detalii de preț:{" "}
            <Link
              href="/pricing"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              /pricing
            </Link>
            .
          </p>
        </ContentSection>

        <ContentSection title="Cum îl folosești împreună cu booking-ul">
          <p>
            Generezi oferta → o postezi pe Instagram sau o trimiți pe WhatsApp →
            clientul rezervă din link. Pentru distribuție, vezi și ghidurile{" "}
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
            .
          </p>
        </ContentSection>

        <ContentSection title="Întrebări frecvente">
          <p>
            Răspunsuri scurte despre Marketing AI, SMS și planuri:{" "}
            <Link
              href="/faq"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              FAQ Frizeo
            </Link>
            .
          </p>
        </ContentSection>
      </ContentShell>
    </>
  );
}
