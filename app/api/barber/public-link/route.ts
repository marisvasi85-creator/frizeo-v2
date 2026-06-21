import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicBookingUrl } from "@/lib/booking/publicBookingPath";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ url: null }, { status: 401 });
  }

  const { data: barber } = await supabase
    .from("barbers")
    .select(`
      slug,
      tenant:tenants (
        slug
      )
    `)
    .eq("user_id", user.id)
    .single();

  const tenantSlug = (barber?.tenant as { slug?: string } | null)?.slug;
  const barberSlug = barber?.slug;

  if (!tenantSlug || !barberSlug) {
    return NextResponse.json({ url: null });
  }

  return NextResponse.json({
    url: publicBookingUrl(tenantSlug, barberSlug),
  });
}
