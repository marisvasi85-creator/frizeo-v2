import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import BarberBookingView from "@/app/booking/_components/BarberBookingView";
import InstallAppPrompt from "@/app/components/pwa/InstallAppPrompt";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stableBookingPath } from "@/lib/booking/publicBookingPath";
import { createPageMetadata } from "@/lib/site/pageMetadata";

const getBarberWithSalon = cache(async (barberId: string) => {
  const { data: barber, error } = await supabaseAdmin
    .from("barbers")
    .select(
      `
      *,
      tenant:tenants (*)
    `,
    )
    .eq("id", barberId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("GET BARBER BY ID:", error);
    return null;
  }

  if (!barber?.tenant) {
    return null;
  }

  return {
    barber,
    salon: barber.tenant as Record<string, unknown> & {
      name: string;
      slug: string;
    },
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ barberId: string }>;
}): Promise<Metadata> {
  const { barberId } = await params;
  const result = await getBarberWithSalon(barberId);

  const path = stableBookingPath(barberId);

  if (!result) {
    return createPageMetadata({
      title: "Frizer indisponibil",
      description: "Pagina de programări nu a fost găsită.",
      path,
      noIndex: true,
      pwa: { startUrl: path, variant: "booking" },
    });
  }

  const barberName = result.barber.display_name || "Frizer";
  const salonName = result.salon.name;

  return createPageMetadata({
    title: `Programare online — ${barberName}`,
    description: `Programează-te la ${barberName}, ${salonName}. Alege serviciul, data și ora disponibilă.`,
    path,
    keywords: [barberName, salonName, "programare frizer online"],
    pwa: {
      startUrl: path,
      variant: "booking",
      label: salonName,
    },
  });
}

export default async function BarberIdBookingPage({
  params,
}: {
  params: Promise<{ barberId: string }>;
}) {
  const { barberId } = await params;
  const result = await getBarberWithSalon(barberId);

  if (!result) {
    notFound();
  }

  const barberSlug = result.barber.slug || barberId;

  return (
    <>
      <BarberBookingView
        salon={result.salon}
        barber={result.barber}
        barberSlug={barberSlug}
      />
      <InstallAppPrompt variant="booking" label={result.salon.name} />
    </>
  );
}
