import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not auth" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  // 🔥 1. creează tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name,
    })
    .select()
    .single();

  if (tenantError) {
    console.error(tenantError);
    return NextResponse.json({ error: "Tenant create failed" }, { status: 500 });
  }

  // 🔥 2. user = owner
  await supabase.from("tenant_users").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  });

  // 🔥 3. set active tenant
  await supabase.from("user_active_tenant").upsert({
    user_id: user.id,
    tenant_id: tenant.id,
  });

  // 🔥 4. cookie
  const res = NextResponse.json({ success: true });

  res.cookies.set("tenant_id", tenant.id, {
    path: "/",
  });

  return res;
}