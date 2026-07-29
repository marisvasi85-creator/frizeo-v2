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

const PATH = "/ghid/programari-whatsapp";

const STEPS = [
  {
    name: "Pregătește link-ul Frizeo",
    text: "Asigură-te că serviciile și programul sunt setate, apoi copiază URL-ul paginii de programări.",
  },
  {
    name: "Salvează un mesaj rapid",
    text: "În WhatsApp Business (sau note) salvezi un răspuns scurt cu link-ul, ca să-l trimiți într-o atingere.",
  },
  {
    name: "Răspunde la cereri cu link-ul",
    text: "Când cineva întreabă de locuri, trimiți mesajul + link. Clientul alege ora fără un schimb lung.",
  },
  {
    name: "Opțional: status / catalog",
    text: "Poți pune link-ul și în status sau într-o notă fixă, ca să-l vadă clienții existenți.",
  },
];

export const metadata = createPageMetadata({
  title: "Programări pe WhatsApp cu link",
  description:
    "Cum folosești WhatsApp împreună cu Frizeo: răspunzi rapid cu link-ul de programări, fără să negociezi fiecare oră pe mesaje.",
  path: PATH,
  keywords: [
    "programări WhatsApp frizerie",
    "link booking WhatsApp",
    "programare frizer WhatsApp",
  ],
});

export default function WhatsAppGuidePage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Ghiduri", path: "/ghid" },
            { name: "WhatsApp", path: PATH },
          ]),
          howToJsonLd({
            name: "Cum folosești Frizeo pe WhatsApp pentru programări",
            description:
              "Pași pentru frizeri: mesaj rapid cu link de booking, fără programări doar pe chat.",
            path: PATH,
            steps: STEPS,
          })
        )}
      />
      <ContentShell
        title="Programări pe WhatsApp, cu link"
        lead="WhatsApp rămâne canalul unde te găsesc clienții. Frizeo preia rezervarea: tu trimiți un link, ei aleg ora."
        cta={{ href: "/signup", label: "Creează cont gratuit" }}
        secondaryCta={{ href: "/ghid", label: "Toate ghidurile" }}
      >
        <ContentSection title="Problema pe care o rezolvi">
          <p>
            Pe chat, „joi la 16?” → „nu pot” → „vineri?” durează. Link-ul mută
            alegerea orei pe calendarul tău real, cu sloturi libere.
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

        <ContentSection title="Exemplu de mesaj">
          <p className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-4 py-4 text-sm text-[var(--mkt-ink-soft)]">
            Salut! Programează-te din link — alegi serviciul și ora liberă:
            [link-ul tău Frizeo]. Dacă nu găsești nimic potrivit, scrie-mi.
          </p>
        </ContentSection>

        <ContentSection title="Cu Instagram împreună">
          <ContentList
            items={[
              "Bio Instagram → programări noi din social",
              "WhatsApp → clienți existenți care tot te scriu",
              "Reminder email/SMS (după plan) → mai puține no-show-uri",
            ]}
          />
          <p className="mt-4">
            Ghid Instagram:{" "}
            <Link
              href="/ghid/link-programari-instagram"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              link în bio
            </Link>
            . Comparație cu telefonul:{" "}
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
