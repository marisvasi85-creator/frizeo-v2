import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone } = await req.json();

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message }, { status: 400 });
    }

    const userId = data.user.id;

    // profile
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: fullName,
      phone,
    });

    // tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .insert({ name: fullName + " Salon" })
      .select()
      .single();

    // tenant_users
    await supabaseAdmin.from("tenant_users").insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: "owner",
    });

    // barber
    await supabaseAdmin.from("barbers").insert({
      user_id: userId,
      tenant_id: tenant.id,
      display_name: fullName,
      phone,
    });

    // active tenant
    await supabaseAdmin.from("user_active_tenant").insert({
      user_id: userId,
      tenant_id: tenant.id,
    });

    return NextResponse.json({
      success: true,
      message: "Verifică email-ul pentru confirmare",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}