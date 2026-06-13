import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { url: null },
      { status: 401 }
    );
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

  if (!barber) {
    return NextResponse.json({
      url: null,
    });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const tenantSlug =
    (barber.tenant as any)?.slug;

  const barberSlug =
    barber.slug;

  return NextResponse.json({
    url: `${appUrl}/${tenantSlug}/${barberSlug}`,
  });
}