import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import FaqList from "@/app/(marketing)/components/FaqList";
import { FRIZEO_FAQS } from "@/lib/site/faqContent";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  jsonLdGraph,
} from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Întrebări frecvente",
  description:
    "Ce este Frizeo, cât costă, cum funcționează trial-ul, SMS-ul și programările online pentru frizerii din România.",
  path: "/faq",
  keywords: [
    "frizeo faq",
    "prețuri frizeo",
    "programări online frizerie întrebări",
    "sms reminder frizerie",
  ],
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Întrebări frecvente", path: "/faq" },
          ]),
          faqPageJsonLd(FRIZEO_FAQS, {
            path: "/faq",
            name: "Întrebări frecvente — Frizeo",
          })
        )}
      />
      <main className="bg-white text-[var(--mkt-ink)]">
        <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <h1 className="mkt-display text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.05]">
            Întrebări frecvente
          </h1>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-[var(--mkt-muted)]">
            Răspunsuri scurte și actualizate despre Frizeo — pentru frizeri,
            saloane și oricine compară opțiuni de programări online în România.
          </p>

          <div className="mt-10">
            <FaqList faqs={FRIZEO_FAQS} />
          </div>

          <p className="mt-10 text-sm text-[var(--mkt-muted)]">
            Vezi{" "}
            <Link
              href="/pricing"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              prețurile
            </Link>
            ,{" "}
            <Link
              href="/programari-online-frizerie"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              cum funcționează programările online
            </Link>{" "}
            sau{" "}
            <Link
              href="/contact"
              className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
            >
              contactează-ne
            </Link>
            .
          </p>

          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex rounded-xl bg-[var(--mkt-ink)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--mkt-ink-soft)]"
            >
              Creează cont gratuit
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
