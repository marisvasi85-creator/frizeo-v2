import { permanentRedirect } from "next/navigation";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";

export default async function LegacyRootBookingRedirect({
  params,
}: {
  params: Promise<{
    tenantSlug: string;
    barberSlug: string;
  }>;
}) {
  const { tenantSlug, barberSlug } = await params;

  permanentRedirect(publicBookingPath(tenantSlug, barberSlug));
}
