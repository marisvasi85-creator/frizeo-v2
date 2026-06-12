import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({
      salon: null,
      barbers: [],
    });
  }

  const { data: tenant, error: tenantError } =
    await supabaseAdmin
      .from("tenants")
      .select("id,name,slug")
      .eq("slug", slug)
      .single();

  console.log("TENANT:", tenant);
  console.log("TENANT ERROR:", tenantError);

  if (!tenant) {
    return NextResponse.json({
      salon: null,
      barbers: [],
    });
  }

  const { data: barbers, error: barbersError } =
    await supabaseAdmin
      .from("barbers")
      .select(`
        id,
        display_name,
        active
      `)
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("display_name");

  console.log("BARBERS:", barbers);
  console.log("BARBERS ERROR:", barbersError);

  return NextResponse.json({
    salon: tenant,
    barbers: barbers || [],
  });
}