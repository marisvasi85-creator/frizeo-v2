import type { FaqItem } from "@/lib/site/faqContent";

export default function FaqList({
  faqs,
  headingLevel = 2,
}: {
  faqs: FaqItem[];
  headingLevel?: 2 | 3;
}) {
  const HeadingTag = headingLevel === 3 ? "h3" : "h2";

  return (
    <div className="divide-y divide-[var(--mkt-line)] border-y border-[var(--mkt-line)]">
      {faqs.map((faq) => (
        <details key={faq.question} className="group py-5">
          <summary className="cursor-pointer list-none marker:content-none">
            <HeadingTag className="flex items-start justify-between gap-4 text-left text-lg font-semibold tracking-tight text-[var(--mkt-ink)]">
              <span>{faq.question}</span>
              <span
                className="mt-1 shrink-0 text-[var(--mkt-muted)] transition group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </HeadingTag>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mkt-muted)]">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
