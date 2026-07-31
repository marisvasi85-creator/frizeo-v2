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
  "Frizeo este platforma online a salonului tău: programări, pagină publică, Google Calendar, notificări automate, Asistent AI și Marketing AI. Trial 30 zile — creezi contul și poți primi programări imediat.";

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
    `${LEGAL_PRICING.trialDays} zile trial`,
    "Pagină salon inclusă",
    "Asistent AI",
    "Marketing AI",
    "Google Calendar",
    "Fără comision",
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
              Haosul din frizerie arată așa
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[var(--mkt-muted)]">
              Dacă recunoști măcar două, Frizeo e făcut pentru tine.
            </p>
            <ul className="mt-10 space-y-4 text-[var(--mkt-steel)]">
              {[
                "Ești în tuns și telefonul sună — clientul renunță după 2 apeluri.",
                "Programările stau în WhatsApp, pe hârtie sau „în cap”.",
                "Nu știi sigur cine vine mâine, la ce oră și pentru ce serviciu.",
                "No-show-urile mănâncă din zi fără reminder automat.",
                "Vrei să postezi pe Instagram, dar tot amâni — și scaunul rămâne gol.",
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
              Cum funcționează
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Frizeo este platforma online a salonului tău — nu doar un calendar
              de programări.
            </p>

            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                {
                  step: "01",
                  title: "Creezi contul",
                  body: "Primești imediat pagina salonului, link-ul de programări și un set de servicii + program gata de folosit. Le ajustezi oricând.",
                },
                {
                  step: "02",
                  title: "Distribuie pagina și link-ul",
                  body: "Le pui pe Instagram, Facebook, WhatsApp, Google sau pe afiș în salon — clienții rezervă fără să te sune.",
                },
                {
                  step: "03",
                  title: "Primești programări",
                  body: "Clienții aleg serviciul, ziua și ora. Tu vezi totul în calendar, cu notificări și Asistent AI la nevoie.",
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
              Vezi fluxul de programare
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[var(--mkt-muted)]">
              Serviciu, calendar, confirmare — în câteva secunde.
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
              Cum arată în practică
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Dashboard, calendar și pagina publică — tot ce ai nevoie ca să
              rulezi salonul online, într-un singur loc.
            </p>
            <ProductScreens />
          </div>
        </section>

        {/* SALON PUBLIC PAGE */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display max-w-3xl text-3xl sm:text-4xl">
              Fiecare salon primește automat propria pagină online.
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--mkt-muted)]">
              Nu e un add-on. La creare cont, salonul are deja o pagină
              profesională pe care o poți distribui pe Facebook, Instagram și
              WhatsApp — optimizată pentru indexare în Google.
            </p>

            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Pagină profesională",
                  body: "Inclusă din start — fără site separat și fără cost extra de „landing”.",
                },
                {
                  title: "Galerie, servicii, prețuri",
                  body: "Clienții văd ce oferi și cât costă, înainte să rezervă.",
                },
                {
                  title: "Recenzii și hartă",
                  body: "Încredere și locație clară, pe aceeași pagină de programări.",
                },
                {
                  title: "Link gata de share",
                  body: "Îl trimiți pe WhatsApp, îl pui în bio sau pe Google — rezervarea e la un tap.",
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

            <p className="mt-10 max-w-2xl text-sm text-[var(--mkt-muted)]">
              Pagina e pregătită pentru indexare și poate fi găsită în Google —
              fără promisiuni de poziții sau ranking.
            </p>

            <div className="mt-8">
              <InlineCta href="/signup" label="Creează contul — primești pagina" />
            </div>
          </div>
        </section>

        {/* AUTOMATIONS */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mkt-display text-3xl sm:text-4xl">
                Confirmări și reminder-e pe pilot automat
              </h2>
              <p className="mt-4 text-[var(--mkt-muted)]">
                Nu mai scrii manual. Confirmările, anulările și reprogramările
                pleacă pe email; reminder-ul poate merge și pe SMS — tu alegi ce
                e activ.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[var(--mkt-steel)]">
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>Confirmare imediată după programare</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>
                    Reminder înainte de vizită — email și SMS (planuri Pro)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[var(--mkt-accent)]" aria-hidden>
                    →
                  </span>
                  <span>{LEGAL_PRICING.includedNote}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--mkt-line)] bg-white p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                Exemplu SMS
              </p>
              <div className="mt-4 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-4 py-4 text-sm leading-relaxed text-[var(--mkt-ink-soft)]">
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
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--mkt-muted)]">
                Asistent AI
              </p>
              <h2 className="mkt-display mt-3 text-3xl sm:text-4xl">
                Asistent AI pentru programări
              </h2>
              <p className="mt-4 text-[var(--mkt-muted)]">
                Din admin, gestionezi programările în limbaj natural — scrii
                sau vorbești, fără să cauți prin meniuri când ești în mijlocul
                zilei.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[var(--mkt-steel)]">
                {[
                  "Creează programări noi",
                  "Reprogramează sau anulează",
                  "Răspunde la întrebări despre disponibilitate",
                  "Conversație naturală — nu formulare greoaie",
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

            <div className="rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--mkt-muted)]">
                Exemplu conversație
              </p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed">
                <div className="rounded-xl border border-[var(--mkt-line)] bg-white px-4 py-3 text-[var(--mkt-ink-soft)]">
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
                Exemplu ilustrativ. Asistentul folosește programul și
                disponibilitatea reală din contul tău.
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
                Atu Frizeo · Marketing AI
              </p>
              <h2 className="mkt-display mt-3 max-w-3xl text-3xl sm:text-4xl md:text-5xl">
                Promovezi salonul fără să angajezi un social media manager
              </h2>
              <p className="mt-4 max-w-2xl text-base text-white/65 sm:text-lg">
                Generezi postări, story-uri, scripturi pentru Reel și oferte pe
                serviciile tale — cu tonul brandului și link-ul de programări
                inclus. Card vizual descărcabil, gata de Instagram.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-white/70">
                {[
                  "Text + hashtag-uri + CTA cu link-ul tău Frizeo",
                  "Promoții pe serviciu, birthday și campanii sezoniere",
                  "Inclus în Free / Pro / Pro+ — limite zilnice, fără pachet separat",
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
                  Cum funcționează
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                Exemplu generat
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-[var(--mkt-ink-soft)] px-4 py-4 text-sm leading-relaxed">
                <p className="font-semibold text-white">Fade fresh · locuri săptămâna asta</p>
                <p className="mt-3 text-white/70">
                  Ai nevoie de un refresh? Programează-te online — alegi ora în
                  30 de secunde, fără telefon.
                </p>
                <p className="mt-3 text-white/45">
                  #barbershop #fade #programacionline
                </p>
                <p className="mt-4 text-xs font-medium text-[var(--mkt-accent-soft)]">
                  CTA → link-ul tău de booking
                </p>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/40">
                Exemplu ilustrativ. Conținutul real folosește numele salonului,
                serviciile și orașul tău.
              </p>
            </div>
          </div>
        </section>

        {/* DIRECTORY */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display max-w-3xl text-3xl sm:text-4xl">
              Fii găsit de clienți noi din orașul tău
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--mkt-muted)]">
              Nu doar link în bio — apari în directorul Frizeo pe oraș, pe hartă,
              cu servicii, poze și recenzii. Clienții noi rezervă direct.
            </p>

            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                {
                  title: "Director pe oraș",
                  body: "Pagini locale tip „frizerii în [oraș]” — vizibilitate fără comision pe programare.",
                },
                {
                  title: "Hartă & filtre",
                  body: "Fade, barbă, tuns, copii — clienții găsesc exact ce caută.",
                },
                {
                  title: "Recenzii",
                  body: "Cereri de review după vizită. Încredere înainte de prima programare.",
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
              <InlineCta href="/signup" label="Listează salonul" />
              <Link
                href="/frizerii"
                className="text-sm font-semibold text-[var(--mkt-accent)] hover:underline"
              >
                Vezi directorul Frizerii →
              </Link>
            </div>
          </div>
        </section>

        {/* OPS STACK */}
        <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Tot ce ai nevoie ca să rulezi salonul
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Programări, Google Calendar, notificări, echipă și rapoarte —
              platforma online a salonului, nu doar un link de booking.
            </p>

            <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {[
                {
                  title: "Google Calendar sync",
                  body: "Evenimente create/actualizate automat și free/busy ca să nu se dubleze programările.",
                },
                {
                  title: "Program flexibil",
                  body: "Ore săptămânale, override pe zile, concedii și regulă de preaviz (0–24h).",
                },
                {
                  title: "Echipă până la 3 frizeri",
                  body: "Pe Pro+: invitații, pagină de salon și vizibilitate pe programările echipei.",
                },
                {
                  title: "Rapoarte clare",
                  body: "Confirmate / anulate, clienți unici, venit estimat — pe frizer și pe serviciu.",
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

        {/* WHY FRIZEO — deeper detail after trust strip */}
        <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mkt-display text-center text-3xl sm:text-4xl">
              Frizeo este platforma online a salonului tău
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
              Sistem de programări, pagina oficială, Google Calendar, notificări
              automate, Asistent AI și Marketing AI — creat pentru frizerii din
              România, nu un tool generic de beauty.
            </p>

            <dl className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  dt: "Pornești imediat",
                  dd: "Creezi contul și poți primi programări — serviciile și programul sunt deja configurate.",
                },
                {
                  dt: "Pagină salon inclusă",
                  dd: "Galerie, servicii, prețuri, recenzii, hartă și link de programări — gata de share.",
                },
                {
                  dt: `${LEGAL_PRICING.trialDays} zile trial`,
                  dd: "Independent pe Pro, salon pe Pro+ — fără card la start.",
                },
                {
                  dt: "Notificări + Calendar",
                  dd: "Email pe toate planurile; SMS reminder pe Pro / Pro+ / trial; sync Google Calendar.",
                },
                {
                  dt: "Asistent AI + Marketing AI",
                  dd: "Gestionezi programări în limbaj natural și generezi conținut pentru Instagram.",
                },
                {
                  dt: "Factură în România",
                  dd: "Companie românească, facturare fiscală — suport local, nu un SaaS străin.",
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
              Răspunsuri scurte despre Frizeo, prețuri, SMS și cum funcționează
              programările.
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
              Prețuri simple, fără costuri ascunse
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--mkt-muted)]">
              {LEGAL_PRICING.trialDays} zile trial. Apoi Free, Pro, Pro+ sau
              Custom — tu alegi.
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
                      {plan.bookings} · {plan.barbers}
                    </p>
                  </div>
                ))}
            </div>

            <Link
              href="/pricing"
              className="mt-10 inline-flex rounded-xl border border-[var(--mkt-line)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--mkt-ink)] transition hover:bg-white/80"
            >
              Compară toate planurile
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
              "Serviciile și programul sunt deja configurate",
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
