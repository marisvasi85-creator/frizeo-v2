import { getAppUrl } from "@/lib/app/getAppUrl";
import { ensureBarberSlug } from "@/lib/barbers/ensureBarberSlug";
import { publicBookingUrl } from "@/lib/booking/publicBookingPath";
import { ensureTenantSlug } from "@/lib/tenant/ensureTenantSlug";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingContext } from "./types";

export async function buildMarketingContext(
  tenantId: string,
  barberId: string,
): Promise<MarketingContext | null> {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, name, description, address, slug")
    .eq("id", tenantId)
    .maybeSingle();

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, display_name, bio, instagram_url, facebook_url, tiktok_url, slug")
    .eq("id", barberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenant || !barber) return null;

  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id, display_name, name, duration, price, show_price")
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const tenantSlug = await ensureTenantSlug(tenant);
  const barberSlug = await ensureBarberSlug(barber);
  const bookingUrl = publicBookingUrl(tenantSlug, barberSlug, getAppUrl());

  return {
    salonName: tenant.name,
    salonDescription: tenant.description,
    salonAddress: tenant.address,
    barberName: barber.display_name || "Frizer",
    barberBio: barber.bio,
    barberInstagram: barber.instagram_url,
    bookingUrl,
    services: (services || []).map((service) => ({
      id: service.id,
      name: service.display_name || service.name,
      duration: service.duration,
      price: service.price,
      showPrice: service.show_price ?? true,
    })),
  };
}
