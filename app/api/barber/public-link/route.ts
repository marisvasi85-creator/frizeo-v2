import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import {
  publicBookingUrl,
  publicSalonUrl,
} from "@/lib/booking/publicBookingPath";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

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

  let tenantSlug = tenant.slug;
  let barberSlug = barber.slug;

  if (!tenantSlug) {
    tenantSlug = slugify(tenant.name || "salon");
    await supabaseAdmin
      .from("tenants")
      .update({ slug: tenantSlug })
      .eq("id", tenant.id);
  }

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
