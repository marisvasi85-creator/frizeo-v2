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

const homeTitle = `${SITE_NAME} — Platforma online a salonului tău`;
const homeDescription =
  "Cu Frizeo, creezi contul și poți primi programări imediat. Clienții te găsesc mai ușor, se programează online, iar tu nu mai răspunzi la telefon în timp ce tunzi. Trial 30 zile, fără card.";

const homeMetadata = createPageMetadata({
  title: homeTitle,
  description: homeDescription,
  path: "/",
  keywords: [
    "programări online frizerie România",
    "programări salon România",
    "calendar frizerie",
    "barbershop programări",
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
  const trustPoints = [
    "Programări din prima zi",
    "Mai puține apeluri în timpul tunsului",
    "Mai puține programări uitate",
    "Clienți noi din oraș",
    "Fără comision",
    `${LEGAL_PRICING.trialDays} zile fără card`,
  ];

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
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="mkt-hero-atmosphere absolute inset-0" />
          <div className="mkt-hero-grain absolute inset-0" />

          <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-10 text-center sm:pt-20 sm:pb-12">
            <h1 className="mkt-display mkt-rise text-[clamp(3.4rem,12vw,6.5rem)] leading-[0.9] text-[var(--mkt-ink)]">
              Frizeo
            </h1>

            <p className="mkt-rise mkt-rise-delay-1 mx-auto mt-6 max-w-2xl text-xl font-medium tracking-tight text-[var(--mkt-ink-soft)] sm:text-2xl md:text-[1.85rem]">
              Creezi contul și poți primi programări imediat.
            </p>

            <p className="mkt-rise mkt-rise-delay-2 mx-auto mt-4 max-w-xl text-base text-[var(--mkt-muted)] sm:text-lg">
              Serviciile și programul sunt configurate automat. Le personalizezi
              oricând.
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
              Începi în mai puțin de un minut · {LEGAL_PRICING.trialDays} zile
              trial · fără card
            </p>
          </div>

          <BookingHeroVisual />
        </section>

        {/* COMPETITIVE TRUST STRIP — high, scannable */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-8">
          <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-[var(--mkt-ink-soft)]">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--mkt-accent)]"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
        </section>

        {/* PROBLEM */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Ce te costă haosul din programări
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[var(--mkt-muted)]">
              Dacă recunoști măcar două, Frizeo îți dă înapoi timp și scaun
              ocupat.
            </p>
            <ul className="mt-10 space-y-4 text-[var(--mkt-steel)]">
              {[
                "Răspunzi la telefon în timp ce tunzi — și pierzi ritmul.",
                "Clienții renunță după 2 apeluri fără răspuns.",
                "Nu știi sigur cine vine mâine, la ce oră și pentru ce.",
                "Programările uitate lasă scaunul gol.",
                "Amâni promovarea pe Instagram — și agenda rămâne rară.",
              ].map((item) => (
                <li
                  key={item}
                  className="border-l-2 border-[var(--mkt-accent)] pl-4 text-base sm:text-lg"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="cum-functioneaza"
          className="border-t border-[var(--mkt-line)] bg-white px-6 py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Ce câștigi, pas cu pas
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Nu mai alergi după mesaje. Clienții rezervă singuri — tu rămâi la
              scaun.
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
                  title: "Clienții te găsesc mai ușor",
                  body: "Le trimiți un link pe WhatsApp, Instagram sau Facebook. Rezervă fără să te întrerupă.",
                },
                {
                  step: "03",
                  title: "Tu doar tunzi",
                  body: "Vezi cine vine, la ce oră, fără să ții agenda în cap sau pe hârtie.",
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

        {/* VIDEO — early, right after how it works */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Cum arată o programare fără telefon
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[var(--mkt-muted)]">
              Clientul alege, tu confirmi dintr-o privire — fără să întrerupi
              tunsul.
            </p>
            <div className="relative mt-10 aspect-video w-full overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${LANDING_VIDEO_ID}?rel=0`}
                title="Frizeo — programări online pentru frizerii și saloane"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="mt-8 text-center">
              <InlineCta href="/signup" label="Creează cont gratuit" />
            </div>
          </div>
        </section>

        {/* PRODUCT SCREENS */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Ziua ta, fără haos
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Știi cine vine, ce vrea și când — fără să cauți prin mesaje.
            </p>
            <ProductScreens />
          </div>
        </section>

        {/* SALON PUBLIC PAGE */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display max-w-3xl text-3xl sm:text-4xl">
              Clienții te găsesc mai ușor și se programează online.
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--mkt-muted)]">
              La creare cont, salonul tău e deja vizibil online — gata de share
              pe Facebook, Instagram și WhatsApp. Poate fi găsit și în Google,
              fără să-ți construiești un site separat.
            </p>

            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Mai multă încredere înainte de rezervare",
                  body: "Clienții văd poze, servicii și prețuri — știu la ce să se aștepte.",
                },
                {
                  title: "Mai puține mesaje „cât costă?”",
                  body: "Informațiile esențiale sunt pe pagină; rezervarea e următorul pas.",
                },
                {
                  title: "Mai ușor de recomandat",
                  body: "Trimiți un link, nu o explicație lungă pe WhatsApp.",
                },
                {
                  title: "Șansă să fii găsit local",
                  body: "Pagina e pregătită pentru indexare în Google — fără promisiuni de poziții.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <InlineCta href="/signup" label="Creează contul — începe să fii găsit" />
            </div>
          </div>
        </section>

        {/* AUTOMATIONS */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mkt-display text-3xl sm:text-4xl">
                Mai puține programări uitate
              </h2>
              <p className="mt-4 text-[var(--mkt-muted)]">
                Clienții primesc confirmări și reminder-e fără să scrii tu
                mesaje. Tu câștigi scaun ocupat — nu timp pe telefon.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[var(--mkt-steel)]">
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>Mai puține no-show-uri înainte de vizită</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>Nu mai trimiți manual „te așteptăm mâine”</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>
                    Reminder pe SMS la planurile Pro / Pro+ / trial — fără
                    credite de reîncărcat
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                Exemplu reminder
              </p>
              <div className="mt-4 rounded-xl border border-[var(--mkt-line)] bg-white px-4 py-4 text-sm leading-relaxed text-[var(--mkt-ink-soft)]">
                <p className="font-semibold text-[var(--mkt-ink)]">Frizeo</p>
                <p className="mt-2">
                  Reminder: ai programare astăzi la ora 14:00.
                </p>
                <p className="mt-1 text-[var(--mkt-muted)]">Te așteptăm!</p>
              </div>
            </div>
          </div>
        </section>

        {/* ASSISTANT AI */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-muted)]">
                Asistent AI
              </p>
              <h2 className="mkt-display mt-3 text-3xl sm:text-4xl">
                Rezolvi programările fără să pierzi ritmul
              </h2>
              <p className="mt-4 text-[var(--mkt-muted)]">
                Când ești între clienți, spui ce ai nevoie — asistentul creează,
                mută sau anulează. Tu nu cauți prin meniuri.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[var(--mkt-steel)]">
                {[
                  "Adaugi o programare în câteva secunde",
                  "Muți sau anulezi fără să întrerupi tunsul mult",
                  "Afli rapid dacă mai ai loc — fără să răsfoiești agenda",
                  "Vorbești sau scrii natural, ca unui coleg",
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

            <div className="rounded-2xl border border-[var(--mkt-line)] bg-white p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                Exemplu conversație
              </p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed">
                <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-4 py-3 text-[var(--mkt-ink-soft)]">
                  <p className="text-xs font-medium text-[var(--mkt-muted)]">
                    Tu
                  </p>
                  <p className="mt-1">
                    Ai loc mâine după-amiază pentru un fade?
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-4 py-3 text-white">
                  <p className="text-xs font-medium text-white/45">
                    Asistent Frizeo
                  </p>
                  <p className="mt-1 text-white/85">
                    Da — liber mâine la 14:00 și 16:30. Vrei să rezerv 14:00?
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[var(--mkt-muted)]">
                Exemplu ilustrativ. Asistentul folosește disponibilitatea reală
                din contul tău.
              </p>
            </div>
          </div>
        </section>

        {/* MARKETING AI */}
        <section
          id="marketing-ai"
          className="border-t border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-6 py-20 text-white"
        >
          <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
                Marketing AI
              </p>
              <h2 className="mkt-display mt-3 max-w-3xl text-3xl sm:text-4xl md:text-5xl">
                Umpli scaunul fără să stai ore pe Instagram
              </h2>
              <p className="mt-4 max-w-2xl text-base text-white/65 sm:text-lg">
                Când ai locuri libere, generezi rapid o postare sau o ofertă —
                cu link de rezervare. Nu angajezi social media manager ca să
                anunți că ai loc mâine.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-white/70">
                {[
                  "Mai puțin timp pe caption-uri — mai mult timp la scaun",
                  "Oferte clare pe servicii, când vrei să umpli agenda",
                  "Inclus în plan — fără abonament separat de „AI content”",
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
                <InlineCta href="/signup" label="Încearcă Marketing AI" dark />
                <Link
                  href="/marketing-ai"
                  className="inline-flex min-w-[12rem] items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Vezi ce câștigi
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
                serviciile salonului tău.
              </p>
            </div>
          </div>
        </section>

        {/* DIRECTORY */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display max-w-3xl text-3xl sm:text-4xl">
              Atragi clienți noi din orașul tău
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--mkt-muted)]">
              Nu depinzi doar de cei care te au deja pe WhatsApp. Cine caută
              frizerie local poate ajunge la tine și rezervă direct.
            </p>

            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                {
                  title: "Mai multă vizibilitate locală",
                  body: "Apari unde oamenii din oraș caută programări — fără comision pe rezervare.",
                },
                {
                  title: "Clienți care știu ce vor",
                  body: "Filtre pe tip de serviciu — ajung la tine cei potriviți.",
                },
                {
                  title: "Încredere înainte de prima vizită",
                  body: "Recenziile ajută un client nou să aleagă — și să rezervă.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <InlineCta href="/signup" label="Vreau clienți noi" />
              <Link
                href="/frizerii"
                className="text-sm font-semibold text-[var(--mkt-accent)] hover:underline"
              >
                Vezi cum arată directorul →
              </Link>
            </div>
          </div>
        </section>

        {/* OPS STACK */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Rulezi salonul fără dubluri și fără confuzie
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Mai puțin haos în echipă, mai puține ore dublate, mai mult control
              pe ziua ta.
            </p>

            <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {[
                {
                  title: "Nu te mai dublezi pe ore",
                  body: "Agenda ta și Google Calendar rămân aliniate — eviți programări pe același interval.",
                },
                {
                  title: "Concedii fără surprize",
                  body: "Când ești liber, clienții nu mai rezervă. Tu nu explici de 10 ori pe WhatsApp.",
                },
                {
                  title: "Echipă fără haos (Pro+)",
                  body: "Până la 3 frizeri văd programările — mai puține „eu credeam că e liber”.",
                },
                {
                  title: "Știi ce merge și ce nu",
                  body: "Vezi ce servicii și ce zile umplu scaunul — decizii pe date, nu pe senzație.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-t border-[var(--mkt-line)] pt-5"
                >
                  <h3 className="text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY FRIZEO */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Ce câștigă salonul cu Frizeo
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Nu e doar un sistem de programări. E platforma online a salonului
              tău — făcută pentru frizerii din România.
            </p>

            <dl className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  dt: "Timp înapoi",
                  dd: "Nu mai răspunzi la telefon în timp ce tunzi. Clienții rezervă singuri.",
                },
                {
                  dt: "Scaun mai plin",
                  dd: "Mai puține programări uitate. Reminder-ele lucrează în locul tău.",
                },
                {
                  dt: "Clienți noi",
                  dd: "Te găsesc mai ușor online și se programează fără să te caute pe WhatsApp.",
                },
                {
                  dt: "Start imediat",
                  dd: `${LEGAL_PRICING.trialDays} zile fără card. Creezi contul și poți primi programări din prima zi.`,
                },
                {
                  dt: "Promovare fără stres",
                  dd: "Anunți locurile libere pe Instagram fără să stai ore pe texte.",
                },
                {
                  dt: "Suport local",
                  dd: "Factură în România, preț clar în lei — fără surprize de SaaS străin.",
                },
              ].map((item) => (
                <div key={item.dt}>
                  <dt className="mkt-display text-xl text-[var(--mkt-ink)]">
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

        {/* FAQ — GEO / AI-citable answers */}
        <section
          id="intrebari-frecvente"
          className="border-t border-[var(--mkt-line)] bg-white px-6 py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Întrebări frecvente
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Răspunsuri scurte despre ce câștigi cu Frizeo, prețuri și cum
              începi.
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
              , la{" "}
              <Link
                href="/pricing"
                className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
              >
                prețuri
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
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="mkt-display text-3xl sm:text-4xl">
              Începi fără riscuri, crești când ai nevoie
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--mkt-muted)]">
              {LEGAL_PRICING.trialDays} zile gratuit, fără card. Apoi alegi Free,
              Pro sau Pro+ — plătești doar ce folosești.
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
                          ? "Nelimitat + mai puține no-show-uri"
                          : "Echipă + mai puțin haos în programări"}
                    </p>
                  </div>
                ))}
            </div>

            <Link
              href="/pricing"
              className="mt-10 inline-flex rounded-xl border border-[var(--mkt-line)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--mkt-ink)] transition hover:bg-white/80"
            >
              Compară planurile
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-ink)] px-6 py-24 text-center text-white">
          <h2 className="mkt-display text-3xl sm:text-5xl">
            Creezi contul și poți primi programări imediat.
          </h2>
          <ul className="mx-auto mt-8 flex max-w-xl flex-col gap-3 text-left text-sm text-white/70 sm:text-base">
            {[
              `${LEGAL_PRICING.trialDays} zile gratuit`,
              "Nu ai nevoie de card",
              "Poți primi programări din prima zi",
              "Personalizezi totul oricând",
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
