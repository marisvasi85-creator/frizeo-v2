import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Ghiduri Frizeo",
  description:
    "Ghiduri scurte pentru frizeri: cum pui link-ul de programări pe Instagram, WhatsApp și cum reduci apelurile pentru rezervări.",
  path: "/ghid",
  keywords: [
    "ghid programări frizerie",
    "link programări Instagram",
    "programări WhatsApp frizer",
  ],
});

const GUIDES = [
  {
    href: "/marketing-ai",
    title: "Marketing AI pentru frizerii",
    body: "Postări, story, Reel și oferte generate pe serviciile tale — cu link de programări.",
  },
  {
    href: "/ghid/link-programari-instagram",
    title: "Link de programări pe Instagram",
    body: "Cum pui link-ul Frizeo în bio și în stories, fără DM-uri pentru fiecare oră.",
  },
  {
    href: "/ghid/programari-whatsapp",
    title: "Programări pe WhatsApp, cu link",
    body: "Răspuns rapid clienților: un mesaj cu link, nu un schimb de 10 mesaje.",
  },
  {
    href: "/frizeo-vs-programari-pe-telefon",
    title: "Frizeo vs. programări pe telefon",
    body: "Când merită să treci de pe telefon / hârtie pe un link de booking.",
  },
  {
    href: "/programari-online-frizerie",
    title: "Programări online pentru frizerie",
    body: "Prezentare scurtă: flux, prețuri și pentru cine e potrivit Frizeo.",
  },
];

export default function GhidIndexPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Ghiduri", path: "/ghid" },
        ])}
      />
      <main className="bg-white text-[var(--mkt-ink)]">
        <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <h1 className="mkt-display text-3xl sm:text-4xl">Ghiduri Frizeo</h1>
          <p className="mt-5 text-base sm:text-lg text-[var(--mkt-muted)]">
            Pași concreți pentru frizeri și saloane din România — fără jargon,
            fără tutorial interminabil.
          </p>

          <ul className="mt-12 divide-y divide-[var(--mkt-line)] border-y border-[var(--mkt-line)]">
            {GUIDES.map((guide) => (
              <li key={guide.href} className="py-6">
                <Link href={guide.href} className="group block">
                  <h2 className="text-lg font-semibold tracking-tight group-hover:underline">
                    {guide.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--mkt-muted)]">
                    {guide.body}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-sm text-[var(--mkt-muted)]">
            Ai o întrebare? Vezi{" "}
            <Link
              href="/faq"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              FAQ
            </Link>{" "}
            sau{" "}
            <Link
              href="/contact"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              contact
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
