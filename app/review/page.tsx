import { notFound } from "next/navigation";
import Link from "next/link";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import { isMarketingTestimonialsCollectEnabled } from "@/lib/marketing-testimonials/config";
import SubmitMarketingTestimonialForm from "./SubmitMarketingTestimonialForm";

export const metadata = createPageMetadata({
  title: "Lasă o recenzie despre Frizeo",
  description:
    "Spune-ne cum ți se pare Frizeo. Recenzia ta poate ajuta alți frizeri să decidă.",
  path: "/review",
  noIndex: true,
});

export default function MarketingReviewPage() {
  if (!isMarketingTestimonialsCollectEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-frz-fog px-4 py-10">
      <div className="w-full max-w-md bg-frz-card border border-frz-line rounded-2xl p-6 shadow-frz space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="text-frz-ink text-2xl font-semibold hover:opacity-80"
          >
            Frizeo
          </Link>
          <p className="text-frz-ink/60 text-sm mt-1">
            Ce spun frizerii despre Frizeo
          </p>
          <p className="text-frz-ink/50 text-xs mt-2">
            Recenzia ta va fi verificată înainte de publicare.
          </p>
        </div>

        <SubmitMarketingTestimonialForm />
      </div>
    </div>
  );
}
