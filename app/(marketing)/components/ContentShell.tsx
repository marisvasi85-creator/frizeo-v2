import Link from "next/link";

type ContentShellProps = {
  title: string;
  lead: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
};

export default function ContentShell({
  title,
  lead,
  children,
  cta,
  secondaryCta,
}: ContentShellProps) {
  return (
    <main className="bg-white text-[var(--mkt-ink)]">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <h1 className="mkt-display text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.05]">
          {title}
        </h1>
        <p className="mt-5 text-base sm:text-lg leading-relaxed text-[var(--mkt-muted)]">
          {lead}
        </p>

        <div className="mt-10 space-y-8 text-[var(--mkt-steel)] leading-relaxed">
          {children}
        </div>

        {(cta || secondaryCta) && (
          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            {cta && (
              <Link
                href={cta.href}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--mkt-ink)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--mkt-ink-soft)]"
              >
                {cta.label}
              </Link>
            )}
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--mkt-line)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--mkt-ink)] transition hover:bg-[var(--mkt-fog)]"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </article>
    </main>
  );
}

export function ContentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mkt-display text-2xl text-[var(--mkt-ink)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm sm:text-base">{children}</div>
    </section>
  );
}

export function ContentList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm sm:text-base">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="text-[var(--mkt-accent)]" aria-hidden>
            →
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
