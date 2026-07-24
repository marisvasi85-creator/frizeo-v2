import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import { hasSalonReviewsTable } from "@/lib/reviews/salonReviews";
import ReviewForm from "./ReviewForm";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return createPageMetadata({
    title: "Lasă o recenzie",
    description: "Spune-ne cum a fost programarea ta.",
    path: `/review/${token}`,
    noIndex: true,
  });
}

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;

  if (!(await hasSalonReviewsTable())) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center text-gray-600">
        Recenziile nu sunt activate încă.
      </main>
    );
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, client_name, status, tenant_id, tenants(name, slug)")
    .eq("cancel_token", token)
    .maybeSingle();

  if (!booking) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center text-gray-600">
        Link invalid sau expirat.
      </main>
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("salon_reviews")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();

  const tenantRel = booking.tenants as
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
  const tenant = Array.isArray(tenantRel) ? tenantRel[0] : tenantRel;
  const salonName = tenant?.name || "Salon";
  const salonPath = tenant?.slug ? `/booking/salon/${tenant.slug}` : "/";

  if (existing) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center space-y-4">
        <p className="text-gray-700">Ai lăsat deja o recenzie. Mulțumim!</p>
        <a href={salonPath} className="text-black underline text-sm">
          Vezi salonul
        </a>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <ReviewForm
        token={token}
        salonName={salonName}
        clientName={
          (typeof booking.client_name === "string" && booking.client_name) ||
          "Client"
        }
        salonPath={salonPath}
      />
    </main>
  );
}
