import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import FaqList from "@/app/(marketing)/components/FaqList";
import { LEGAL_PRICING } from "@/lib/legal/company";
import { FRIZEO_FAQS } from "@/lib/site/faqContent";
import {
  jsonLdGraph,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/site/jsonLd";
import { SITE_NAME } from "@/lib/site/metadata";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import BookingHeroVisual from "./components/BookingHeroVisual";
import ProductScreens from "./components/ProductScreens";

const LANDING_VIDEO_ID = "do-k1cNkCOg";

const homeTitle = `${SITE_NAME} — Programări online pentru frizerii, barbershop-uri și saloane`;
const homeDescription =
  "Aplicație pentru programări online: pagină profesională, calendar, notificări și Marketing AI. Pentru frizeri independenți și saloane cu echipă. Trial 30 zile, fără card.";

const homeMetadata = createPageMetadata({
  title: homeTitle,
  description: homeDescription,
  path: "/",
  keywords: [
    "programări online frizerie",
    "programări online barbershop",
    "software pentru frizerii",
    "software pentru saloane",
    "aplicație pentru programări",
    "Frizeo",
  ],
});

export const metadata = {
  ...homeMetadata,
  // Avoid "%s | Frizeo" doubling the brand on the homepage.
  title: { absolute: homeTitle },
  openGraph: {
    ...homeMetadata.openGraph,
    title: homeTitle,
  },
  twitter: {
    ...homeMetadata.twitter,
    title: homeTitle,
  },
};

function InlineCta({
  href,
  label,
  dark = false,
}: {
  href: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex rounded-xl px-6 py-3.5 text-sm font-semibold transition ${
        dark
          ? "bg-white text-[var(--mkt-ink)] hover:bg-[var(--mkt-mist)]"
          : "bg-[var(--mkt-ink)] text-white hover:bg-[var(--mkt-ink-soft)]"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Page() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationJsonLd(),
          webSiteJsonLd(),
          softwareApplicationJsonLd()
        )}
      />

      <main>
        {/* 1. HERO */}
        <section className="relative overflow-hidden">
          <div className="mkt-hero-atmosphere absolute inset-0" />
          <div className="mkt-hero-grain absolute inset-0" />

          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-10 text-center sm:pt-20 sm:pb-12">
            <h1 className="mkt-display mkt-rise text-[clamp(3.4rem,12vw,6.5rem)] leading-[0.9] text-[var(--mkt-ink)]">
              Frizeo
            </h1>

            <p className="mkt-rise mkt-rise-delay-1 mx-auto mt-6 max-w-2xl text-xl font-medium tracking-tight text-[var(--mkt-ink-soft)] sm:text-2xl md:text-[1.85rem]">
              Programări online pentru frizerii, barbershop-uri și saloane.
            </p>

            <p className="mkt-rise mkt-rise-delay-2 mx-auto mt-4 max-w-xl text-base text-[var(--mkt-muted)] sm:text-lg">
              Fie că lucrezi singur sau ai o echipă, Frizeo e aplicația pentru
              programări care adună pagina ta, calendarul și notificările —
              totul într-un singur loc.
            </p>

            <div className="mkt-rise mkt-rise-delay-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <InlineCta href="/signup" label="Creează cont gratuit" />
              <Link
                href="/pricing"
                className="inline-flex min-w-[12rem] items-center justify-center rounded-xl border border-[var(--mkt-line)] bg-white/70 px-6 py-3.5 text-sm font-semibold text-[var(--mkt-ink)] transition hover:bg-white"
              >
                Vezi prețurile
              </Link>
            </div>

            <p className="mkt-rise mkt-rise-delay-4 mt-5 text-sm text-[var(--mkt-muted)]">
              Creezi contul și poți primi programări imediat ·{" "}
              {LEGAL_PRICING.trialDays} zile gratuit · Fără card · Anulezi
              oricând
            </p>
          </div>

          <BookingHeroVisual />
        </section>

        {/* 2. CUM FUNCȚIONEAZĂ */}
        <section
          id="cum-functioneaza"
          className="border-t border-[var(--mkt-line)] bg-white px-6 py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Cum pornești programările online
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              De la cont la prima rezervare — fără să alergi după mesaje, indiferent
              dacă ești frizer independent sau ai o locație cu colegi.
            </p>

            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                {
                  step: "01",
                  title: "Pornești fără așteptare",
                  body: "Creezi contul și poți primi programări imediat. Nu stai să configurezi totul înainte de prima rezervare.",
                },
                {
                  step: "02",
                  title: "Clienții rezervă singuri",
                  body: "Le trimiți pagina ta de programări pe WhatsApp, Instagram sau Facebook. Tu nu mai răspunzi la telefon în timp ce tunzi.",
                },
                {
                  step: "03",
                  title: "Tu rămâi la scaun",
                  body: "Vezi cine vine, la ce oră, fără să ții agenda în cap. Reminder-ele reduc programările uitate.",
                },
              ].map((item) => (
                <li key={item.step} className="min-w-0">
                  <p className="mkt-display text-sm text-[var(--mkt-accent)]">
                    {item.step}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. CUM ARATĂ APLICAȚIA */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Cum arată ziua ta în Frizeo
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Software pentru frizerii și saloane făcut să fie clar: știi cine
              vine, ce vrea și când — fără să cauți prin mesaje.
            </p>
            <ProductScreens />

            <div className="mx-auto mt-16 max-w-3xl">
              <h3 className="mkt-display text-center text-2xl sm:text-3xl">
                O programare fără telefon
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-center text-[var(--mkt-muted)]">
                Clientul alege, tu confirmi dintr-o privire — fără să întrerupi
                tunsul.
              </p>
              <div className="relative mt-10 aspect-video w-full overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${LANDING_VIDEO_ID}?rel=0`}
                  title="Frizeo — programări online pentru frizerii, barbershop-uri și saloane"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. MARKETING AI */}
        <section
          id="marketing-ai"
          className="border-t border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-6 py-20 text-white"
        >
          <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                Creștere
              </p>
              <h2 className="mkt-display mt-3 max-w-3xl text-3xl sm:text-4xl md:text-5xl">
                Mai puțin timp pe postări. Mai mult timp pentru clienți.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-white/65 sm:text-lg">
                Frizeo nu doar gestionează programările — te ajută să crești
                afacerea. Generezi conținut de promovare pe serviciile tale, cu
                link de rezervare, fără să stai ore pe Instagram.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-white/70">
                {[
                  "Postări gata de folosit pe Instagram și Facebook",
                  "Carduri promoționale cu brandul locației tale",
                  "Texte pentru oferte, story, Reel și campanii sezoniere",
                  "Economisești timp — anunți locurile libere și te întorci la scaun",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="text-[var(--mkt-accent-soft)]" aria-hidden>
                      →
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <InlineCta href="/signup" label="Umple scaunul mai ușor" dark />
                <Link
                  href="/marketing-ai"
                  className="inline-flex min-w-[12rem] items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Vezi cum te ajută
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                Exemplu postare
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-[var(--mkt-ink-soft)] px-4 py-4 text-sm leading-relaxed">
                <p className="font-semibold text-white">
                  Fade fresh · locuri săptămâna asta
                </p>
                <p className="mt-3 text-white/70">
                  Ai nevoie de un refresh? Programează-te online — alegi ora în
                  30 de secunde, fără telefon.
                </p>
                <p className="mt-3 text-white/45">
                  #barbershop #fade #programacionline
                </p>
                <p className="mt-4 text-xs font-medium text-[var(--mkt-accent-soft)]">
                  Clientul rezervă din link — tu nu răspunzi la DM
                </p>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/40">
                Exemplu ilustrativ. Conținutul real folosește numele și
                serviciile business-ului tău.
              </p>
            </div>
          </div>
        </section>

        {/* 5. RAPOARTE ȘI STATISTICI */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mkt-display text-3xl sm:text-4xl">
                Vezi ce se întâmplă în afacerea ta.
              </h2>
              <p className="mt-4 text-[var(--mkt-muted)]">
                Știi ce îți produce bani și unde mai ai loc de creștere — fără
                să extragi date din Excel.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[var(--mkt-steel)]">
                {[
                  "Vezi imediat cum evoluează veniturile estimate",
                  "Știi câte programări confirmate și anulate ai avut",
                  "Înțelegi gradul de ocupare pe programul tău",
                  "Recunoști clienții unici care revin",
                  "Vezi ce servicii umplu scaunul — și pe care le promovezi",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="text-[var(--mkt-accent)]" aria-hidden>
                      →
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <aside
              aria-label="Exemplu rapoarte Frizeo"
              className="rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] p-5 sm:p-6"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                Exemplu perioadă
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--mkt-ink-soft)]">
                Ultimele 30 de zile · Studio Fade
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: "Venit estimat", value: "12.480 lei" },
                  { label: "Programări", value: "186" },
                  { label: "Grad de ocupare", value: "78%" },
                  { label: "Clienți unici", value: "124" },
                  { label: "Top serviciu", value: "Fade clasic" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-[var(--mkt-line)] bg-white px-3 py-3"
                  >
                    <p className="text-[11px] text-[var(--mkt-muted)]">
                      {metric.label}
                    </p>
                    <p className="mkt-display mt-1 text-lg text-[var(--mkt-ink)]">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[var(--mkt-muted)]">
                Ilustrativ — pe baza statisticilor din contul tău: venit estimat,
                programări, grad de ocupare, clienți unici și breakdown pe
                serviciu.
              </p>
            </aside>
          </div>
        </section>

        {/* 6. PROMOVAREA + PAGINA PUBLICĂ */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display max-w-3xl text-3xl sm:text-4xl">
              Primești o pagină profesională pentru frizeria sau salonul tău.
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--mkt-muted)]">
              Clienții te găsesc mai ușor și se programează online — pe Facebook,
              Instagram, WhatsApp sau din Google. Fără să-ți construiești un site
              separat.
            </p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Galerie foto",
                "Recenzii",
                "Servicii și prețuri",
                "Hartă",
                "Rezervări online",
                "Optimizată pentru Google",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 border-t border-[var(--mkt-line)] pt-4 text-sm font-medium text-[var(--mkt-ink-soft)] sm:text-base"
                >
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-14 grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <h3 className="mkt-display text-2xl sm:text-3xl">
                  Atragi clienți noi din orașul tău
                </h3>
                <p className="mt-3 max-w-xl text-[var(--mkt-muted)]">
                  Nu depinzi doar de cei care te au deja pe WhatsApp. Cine caută
                  un frizer sau un barbershop local poate ajunge la tine și
                  rezervă direct.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <InlineCta href="/signup" label="Vreau pagina mea" />
                  <Link
                    href="/frizerii"
                    className="text-sm font-semibold text-[var(--mkt-accent)] hover:underline"
                  >
                    Vezi cum arată directorul →
                  </Link>
                </div>
              </div>

              <aside
                aria-label="Exemplu rezultat Google"
                className="rounded-2xl border border-[var(--mkt-line)] bg-white p-5 sm:p-6"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                  Exemplu pe Google
                </p>
                <div className="mt-4 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-4 py-4">
                  <div className="flex items-center gap-2 rounded-full border border-[var(--mkt-line)] bg-white px-3 py-2 text-sm text-[var(--mkt-steel)]">
                    <span className="text-[var(--mkt-muted)]" aria-hidden>
                      ⌕
                    </span>
                    Frizer Arad
                  </div>
                  <div className="mt-5 border-t border-[var(--mkt-line)] pt-4">
                    <p className="text-xs text-[var(--mkt-muted)]">Google</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--mkt-accent)]">
                      Studio Fade
                    </p>
                    <p
                      className="mt-1 text-sm text-amber-600"
                      aria-label="5 stele"
                    >
                      ★★★★★
                    </p>
                    <p className="mt-2 text-sm text-[var(--mkt-steel)]">
                      Programare online · Frizer Arad
                    </p>
                    <p className="mt-3 text-xs text-[var(--mkt-muted)]">
                      www.frizeo.ro/booking/salon/…
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--mkt-muted)]">
                  Ilustrativ — clientul caută, găsește locația ta, rezervă. Fără
                  promisiuni de poziții în Google.
                </p>
              </aside>
            </div>
          </div>
        </section>

        {/* 7. FUNCȚIONALITĂȚI */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Tot ce ai nevoie ca să rulezi business-ul
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Nu e o listă de butoane. E timpul, scaunul și clienții pe care îi
              câștigi înapoi — ca frizer, barbershop sau salon.
            </p>

            <dl className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  dt: "Nu mai răspunzi la telefon în timp ce tunzi",
                  dd: "Clienții rezervă singuri din pagina ta de programări. Tu vezi agenda dintr-o privire.",
                },
                {
                  dt: "Mai puține programări uitate",
                  dd: "Confirmări pe email și reminder pe SMS (Pro / Pro+ / trial) — fără să scrii tu mesaje.",
                },
                {
                  dt: "Rezolvi programările fără să pierzi ritmul",
                  dd: "Asistentul Frizeo creează, mută sau anulează când ești între clienți.",
                },
                {
                  dt: "Fără ore dublate",
                  dd: "Agenda ta și Google Calendar rămân aliniate — eviți confuzia din programări.",
                },
                {
                  dt: "Concedii fără surprize",
                  dd: "Când ești liber, clienții nu mai rezervă. Tu nu explici de 10 ori pe WhatsApp.",
                },
                {
                  dt: "Echipă fără haos (Pro+)",
                  dd: "Până la 3 frizeri văd programările — mai puține „eu credeam că e liber”.",
                },
                {
                  dt: "Vezi imediat cum evoluează afacerea",
                  dd: "Venituri estimate, programări, clienți unici și grad de ocupare pe programul tău.",
                },
              ].map((item) => (
                <div
                  key={item.dt}
                  className="border-t border-[var(--mkt-line)] pt-5"
                >
                  <dt className="text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
                    {item.dt}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {item.dd}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 8. COMPARAȚIE */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              De ce nu mai e suficient telefonul
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Telefonul nu dispare. Ideea e să nu mai fii tu agenda pentru
              fiecare oră — fie că ești frizer solo, fie că ai un salon.
            </p>

            <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-white">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-[var(--mkt-line)] text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--mkt-muted)] sm:text-sm sm:normal-case sm:tracking-normal">
                <div className="px-4 py-4 sm:px-6">Situație</div>
                <div className="border-l border-[var(--mkt-line)] px-3 py-4 sm:px-5">
                  Telefon / hârtie
                </div>
                <div className="border-l border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-3 py-4 text-white sm:px-5">
                  Cu Frizeo
                </div>
              </div>
              {[
                {
                  situation: "În timpul tunsului",
                  old: "Răspunzi la telefon și pierzi ritmul",
                  neu: "Clientul rezervă singur — tu continui",
                },
                {
                  situation: "Programări uitate",
                  old: "Speri că își amintește",
                  neu: "Mai puține no-show-uri cu reminder automat",
                },
                {
                  situation: "Clienți noi",
                  old: "Depinzi de WhatsApp și recomandări",
                  neu: "Pagină profesională + promovare cu link de rezervare",
                },
                {
                  situation: "Decizii de business",
                  old: "Ghicești ce merge",
                  neu: "Vezi imediat cum evoluează afacerea",
                },
                {
                  situation: "Cost pe rezervare",
                  old: "Timpul tău pe fiecare apel",
                  neu: "Fără comision pe programare",
                },
              ].map((row) => (
                <div
                  key={row.situation}
                  className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-[var(--mkt-line)] last:border-b-0 text-sm"
                >
                  <div className="px-4 py-4 font-medium text-[var(--mkt-ink)] sm:px-6">
                    {row.situation}
                  </div>
                  <div className="border-l border-[var(--mkt-line)] px-3 py-4 text-[var(--mkt-muted)] sm:px-5">
                    {row.old}
                  </div>
                  <div className="border-l border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-3 py-4 font-medium text-[var(--mkt-ink-soft)] sm:px-5">
                    {row.neu}
                  </div>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[var(--mkt-muted)]">
              Comparație detaliată:{" "}
              <Link
                href="/frizeo-vs-programari-pe-telefon"
                className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
              >
                Frizeo vs. programări pe telefon
              </Link>
              .
            </p>
          </div>
        </section>

        {/* FAQ — kept for SEO / GEO before pricing */}
        <section
          id="intrebari-frecvente"
          className="border-t border-[var(--mkt-line)] bg-white px-6 py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Întrebări frecvente
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Răspunsuri scurte despre programările online cu Frizeo, prețuri și
              cum începi.
            </p>

            <div className="mt-12">
              <FaqList faqs={FRIZEO_FAQS} headingLevel={3} />
            </div>

            <p className="mt-8 text-center text-sm text-[var(--mkt-muted)]">
              Mai multe pe pagina de{" "}
              <Link
                href="/faq"
                className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
              >
                întrebări frecvente
              </Link>
              .
            </p>
          </div>
        </section>

        {/* 9. PREȚURI */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mkt-display text-3xl sm:text-4xl">
              Începi fără riscuri, crești când ai nevoie
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--mkt-muted)]">
              {LEGAL_PRICING.trialDays} zile gratuit, fără card. Apoi alegi Free,
              Pro sau Pro+ — pentru un frizer solo sau pentru un salon cu
              echipă.
            </p>

            <div className="mt-12 grid gap-6 text-left sm:grid-cols-3">
              {LEGAL_PRICING.plans
                .filter((p) => p.slug !== "custom")
                .map((plan) => (
                  <div
                    key={plan.slug}
                    className={`rounded-2xl border p-6 ${
                      plan.highlighted
                        ? "border-[var(--mkt-ink)] bg-[var(--mkt-ink)] text-white"
                        : "border-[var(--mkt-line)] bg-white"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        plan.highlighted
                          ? "text-white/60"
                          : "text-[var(--mkt-muted)]"
                      }`}
                    >
                      {plan.name}
                    </p>
                    <p className="mkt-display mt-2 text-3xl">
                      {plan.price}
                      {plan.priceNote && (
                        <span
                          className={`ml-1 text-sm font-normal ${
                            plan.highlighted
                              ? "text-white/50"
                              : "text-[var(--mkt-muted)]"
                          }`}
                          style={{ fontFamily: "var(--font-mkt-body)" }}
                        >
                          {plan.priceNote}
                        </span>
                      )}
                    </p>
                    <p
                      className={`mt-3 text-sm ${
                        plan.highlighted
                          ? "text-white/70"
                          : "text-[var(--mkt-muted)]"
                      }`}
                    >
                      {plan.slug === "free"
                        ? "Pornești fără presiune"
                        : plan.slug === "pro"
                          ? "Ideal pentru frizer independent"
                          : "Pentru barbershop sau salon cu echipă"}
                    </p>
                  </div>
                ))}
            </div>

            <p className="mt-8 text-sm font-medium text-[var(--mkt-ink-soft)]">
              {LEGAL_PRICING.trialDays} zile gratuit · Fără card · Anulezi
              oricând
            </p>

            <Link
              href="/pricing"
              className="mt-6 inline-flex rounded-xl border border-[var(--mkt-line)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--mkt-ink)] transition hover:bg-white/80"
            >
              Compară planurile
            </Link>
          </div>
        </section>

        {/* 10. CTA FINAL */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-6 py-24 text-center text-white">
          <h2 className="mkt-display text-3xl sm:text-5xl">
            Creezi contul și poți primi programări imediat.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/65">
            Aplicație pentru programări online — pagină profesională, calendar,
            promovare și statistici, într-un singur loc.
          </p>
          <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-3 text-left text-sm text-white/70 sm:text-base">
            {[
              `${LEGAL_PRICING.trialDays} zile gratuit`,
              "Nu ai nevoie de card",
              "Poți primi programări din prima zi",
              "Anulezi oricând",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="text-[var(--mkt-accent-soft)]" aria-hidden>
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <InlineCta href="/signup" label="Creează cont gratuit" dark />
            <Link
              href="/frizerii"
              className="inline-flex min-w-[12rem] items-center justify-center rounded-xl border border-white/25 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Vezi frizerii pe hartă
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
