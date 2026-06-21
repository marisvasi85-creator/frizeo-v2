import { permanentRedirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";

export default async function LegacyBarberIdBookingRedirect({
  params,
}: {
  params: Promise<{ barberId: string }>;
}) {
  const { barberId } = await params;

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select(`
      slug,
      tenant:tenants (
        slug
      )
    `)
    .eq("id", barberId)
    .eq("active", true)
    .single();

  const tenantSlug = (barber?.tenant as { slug?: string } | null)?.slug;
  const barberSlug = barber?.slug;

  if (!tenantSlug || !barberSlug) {
    notFound();
  }

  permanentRedirect(publicBookingPath(tenantSlug, barberSlug));
}
