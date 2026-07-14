import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  publicBookingUrl,
  publicSalonUrl,
  stableBookingUrl,
} from "@/lib/booking/publicBookingPath";
import { ensureBarberSlug } from "@/lib/barbers/ensureBarberSlug";
import { ensureTenantSlug } from "@/lib/tenant/ensureTenantSlug";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return NextResponse.json({ url: null }, { status: 401 });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug")
    .eq("id", barber.tenant_id)
    .single();

  if (!tenant) {
    return NextResponse.json({ url: null });
  }

  try {
    const tenantSlug = await ensureTenantSlug(tenant);
    const barberSlug = await ensureBarberSlug({
      id: barber.id,
      tenant_id: barber.tenant_id,
      display_name: barber.display_name,
      slug: barber.slug,
    });

    const appUrl = getAppUrl();
    const stableUrl = stableBookingUrl(barber.id, appUrl);
    const prettyUrl = barberSlug
      ? publicBookingUrl(tenantSlug, barberSlug, appUrl)
      : publicSalonUrl(tenantSlug, appUrl);

    return NextResponse.json({
      url: stableUrl,
      stableUrl,
      prettyUrl,
    });
  } catch (error) {
    console.error("barber/public-link:", error);
    return NextResponse.json(
      { url: null, error: "Nu s-a putut genera linkul" },
      { status: 500 }
    );
  }
}
