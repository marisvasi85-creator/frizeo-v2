import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.redirect(new URL("/select-tenant", req.url));
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  await supabase.from("user_active_tenant").upsert({
    user_id: user.id,
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.redirect(new URL("/admin/dashboard", req.url));
}
