import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import BarberBookingView from "@/app/booking/_components/BarberBookingView";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import {
  resolveBarberBySlug,
  resolveTenantBySlug,
} from "@/lib/slugs/slugRedirects";
import {
  buildBarberSeoDescription,
  buildBarberSeoTitle,
  buildSalonSeoKeywords,
  salonCity,
} from "@/lib/seo/salonSeo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string;
    barberSlug: string;
  }>;
}): Promise<Metadata> {
  const { slug, barberSlug } = await params;
  const resolvedTenant = await resolveTenantBySlug(slug);

  if (!resolvedTenant) {
    return createPageMetadata({
      title: "Salon inexistent",
      description: "Pagina salonului nu a fost găsită.",
      path: `/booking/salon/${slug}/${barberSlug}`,
      noIndex: true,
      pwa: {
        startUrl: `/booking/salon/${slug}/${barberSlug}`,
        variant: "booking",
      },
    });
  }

  const resolvedBarber = await resolveBarberBySlug(
    resolvedTenant.tenant.id,
    barberSlug
  );

  if (!resolvedBarber) {
    return createPageMetadata({
      title: "Frizer indisponibil",
      description: `${barberSlug} nu este disponibil pentru programări online.`,
      path: `/booking/salon/${slug}/${barberSlug}`,
      noIndex: true,
      pwa: {
        startUrl: `/booking/salon/${slug}/${barberSlug}`,
        variant: "booking",
        label: String(resolvedTenant.tenant.name),
      },
    });
  }

  const barberName = String(resolvedBarber.barber.display_name || "Frizer");
  const salon = resolvedTenant.tenant;
  const salonName = String(salon.name);
  const canonicalPath = publicBookingPath(
    resolvedTenant.canonicalSlug,
    resolvedBarber.canonicalSlug
  );
  const city = salonCity(salon);
  const avatar =
    typeof resolvedBarber.barber.avatar_url === "string"
      ? resolvedBarber.barber.avatar_url
      : typeof salon.logo_url === "string"
        ? salon.logo_url
        : null;

  return createPageMetadata({
    title: buildBarberSeoTitle(barberName, salon),
    description: buildBarberSeoDescription(barberName, salon),
    path: canonicalPath,
    keywords: [
      barberName,
      salonName,
      "programare frizer online",
      ...buildSalonSeoKeywords(salon),
      ...(city ? [`frizer ${city}`, `${barberName} ${city}`] : []),
    ],
    image: avatar,
    pwa: {
      startUrl: canonicalPath,
      variant: "booking",
      label: salonName,
    },
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{
    slug: string;
    barberSlug: string;
  }>;
}) {
  const { slug, barberSlug } = await params;
  const resolvedTenant = await resolveTenantBySlug(slug);

  if (!resolvedTenant) {
    return <div>Salon inexistent</div>;
  }

  const [resolvedBarber, inactiveRes] = await Promise.all([
    resolveBarberBySlug(resolvedTenant.tenant.id, barberSlug),
    supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("tenant_id", resolvedTenant.tenant.id)
      .eq("slug", barberSlug)
      .eq("active", false)
      .maybeSingle(),
  ]);

  if (!resolvedBarber) {
    if (inactiveRes.data) {
      return (
        <div className="max-w-xl mx-auto p-6 text-center">
          Frizer indisponibil momentan pentru programări online.
        </div>
      );
    }
    return <div>Frizer inexistent</div>;
  }

  if (resolvedTenant.redirected || resolvedBarber.redirected) {
    permanentRedirect(
      publicBookingPath(
        resolvedTenant.canonicalSlug,
        resolvedBarber.canonicalSlug
      )
    );
  }

  return (
    <BarberBookingView
      salon={resolvedTenant.tenant}
      barber={resolvedBarber.barber}
      barberSlug={resolvedBarber.canonicalSlug}
    />
  );
}
