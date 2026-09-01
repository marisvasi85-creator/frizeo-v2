import Image from "next/image";
import Link from "next/link";
import type { MarketingTestimonial } from "@/lib/marketing-testimonials/types";

function userTypeLabel(userType: MarketingTestimonial["user_type"]) {
  return userType === "barbershop" ? "Barbershop" : "Frizer independent";
}

export default function FrizeoTestimonialsSection({
  testimonials,
}: {
  testimonials: MarketingTestimonial[];
}) {
  return (
    <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-fog)] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mkt-display text-center text-3xl sm:text-4xl">
          Ce spun frizerii despre Frizeo
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--mkt-muted)]">
          Experiențe reale de la frizeri care folosesc platforma — fără filtre
          de marketing.
        </p>

        {testimonials.length > 0 ? (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.id}
                className="flex h-full flex-col rounded-2xl border border-[var(--mkt-line)] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {item.photo_url ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[var(--mkt-line)]">
                      <Image
                        src={item.photo_url}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mkt-ink)] text-sm font-semibold text-white"
                      aria-hidden
                    >
                      {item.author_name.trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--mkt-ink)]">
                      {item.author_name}
                    </p>
                    <p className="text-xs text-[var(--mkt-muted)]">
                      {userTypeLabel(item.user_type)}
                      {item.salon_name ? ` · ${item.salon_name}` : ""}
                      {item.city ? ` · ${item.city}` : ""}
                    </p>
                    <p className="mt-1 text-amber-500 text-sm" aria-label={`${item.rating} din 5 stele`}>
                      {"★".repeat(item.rating)}
                      <span className="sr-only">{item.rating} din 5</span>
                    </p>
                  </div>
                </div>

                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-[var(--mkt-ink-soft)]">
                  “{item.body}”
                </blockquote>
              </article>
            ))}
          </div>
        ) : (
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-[var(--mkt-muted)]">
            Recenziile aprobate vor apărea aici.
          </p>
        )}

        <p className="mt-10 text-center text-sm text-[var(--mkt-muted)]">
          Folosești Frizeo?{" "}
          <Link
            href="/review"
            className="font-medium text-[var(--mkt-ink)] underline-offset-2 hover:underline"
          >
            Lasă o recenzie
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
