import Link from "next/link";

export default function BarbershopTeamSection() {
  return (
    <section className="border-t border-[var(--mkt-line)] bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mkt-accent)]">
            Pentru barbershop-uri
          </p>
          <h2 className="mkt-display mt-3 text-3xl sm:text-4xl md:text-5xl">
            Administrezi salonul și lucrezi la scaun din același cont.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--mkt-muted)] sm:text-lg">
            În Frizeo poți fi administrator și frizer în același timp. Îți
            gestionezi propriile programări, vezi activitatea salonului și
            inviți ceilalți frizeri în echipă.
          </p>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-fog)] md:grid-cols-2">
          <article className="border-b border-[var(--mkt-line)] p-6 sm:p-8 md:border-b-0 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mkt-accent)]">
              Linkul salonului
            </p>
            <h3 className="mkt-display mt-3 text-2xl">
              Un singur link pentru întreaga echipă
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mkt-muted)]">
              Distribui pagina barbershop-ului, iar clientul își alege frizerul,
              serviciul și ora disponibilă.
            </p>
          </article>

          <article className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mkt-accent)]">
              Link personal
            </p>
            <h3 className="mkt-display mt-3 text-2xl">
              Fiecare frizer își distribuie propriul link
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mkt-muted)]">
              Fiecare membru al echipei primește un link individual pentru
              Instagram, WhatsApp sau clienții care îl preferă direct.
            </p>
          </article>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-[var(--mkt-line)] p-6">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
              Administrator și frizer
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
              Nu ai nevoie de două conturi. Ai propriul program și propriile
              rezervări, dar păstrezi administrarea salonului, serviciilor și
              echipei.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--mkt-line)] p-6">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
              Îți inviți frizerii
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-muted)]">
              Trimiți invitația direct din Frizeo. Fiecare frizer intră în
              contul său și își gestionează programul și programările.
            </p>
          </article>
        </div>

        <ul className="mt-8 grid gap-x-8 gap-y-3 text-sm font-medium text-[var(--mkt-ink-soft)] sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Un link pentru întregul salon",
            "Link individual pentru fiecare frizer",
            "Clientul își alege frizerul preferat",
            "Program separat pentru fiecare membru",
            "Programările salonului într-un singur loc",
            "Administrator și frizer simultan",
          ].map((benefit) => (
            <li key={benefit} className="flex gap-3">
              <span className="text-[var(--mkt-accent)]" aria-hidden>
                ✓
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-center">
          <Link
            href="/signup"
            className="inline-flex rounded-xl bg-[var(--mkt-ink)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--mkt-ink-soft)]"
          >
            Începe gratuit cu echipa
          </Link>
          <p className="text-sm text-[var(--mkt-muted)]">
            Poți începe singur și îți poți invita frizerii ulterior.
          </p>
        </div>
      </div>
    </section>
  );
}
