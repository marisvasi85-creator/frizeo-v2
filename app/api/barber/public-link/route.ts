import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  publicBookingUrl,
  publicSalonUrl,
} from "@/lib/booking/publicBookingPath";
import { ensureTenantSlug } from "@/lib/tenant/ensureTenantSlug";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

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

  const tenantSlug = await ensureTenantSlug(tenant);
  let barberSlug = barber.slug;

  if (!barberSlug) {
    barberSlug = slugify(barber.display_name || "frizer");
    await supabaseAdmin
      .from("barbers")
      .update({ slug: barberSlug })
      .eq("id", barber.id);
  }

  const appUrl = getAppUrl();

  const url = barberSlug
    ? publicBookingUrl(tenantSlug, barberSlug, appUrl)
    : publicSalonUrl(tenantSlug, appUrl);

  return NextResponse.json({ url });
}
