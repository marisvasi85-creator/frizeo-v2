import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone } = await req.json();

    // =========================
    // 🔥 CREATE USER (FĂRĂ CONFIRM EMAIL)
    // =========================
    const { data, error } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 🔥 bypass confirm
      });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message }, { status: 400 });
    }

    const userId = data.user.id;

    // =========================
    // 🔥 PROFILE
    // =========================
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: fullName,
      phone,
    });

    // =========================
    // 🔥 TENANT
    // =========================
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: fullName + " Salon",
      })
      .select()
      .single();

    // =========================
    // 🔥 TENANT USER
    // =========================
    await supabaseAdmin.from("tenant_users").insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: "owner",
    });

    // =========================
    // 🔥 BARBER
    // =========================
    await supabaseAdmin.from("barbers").insert({
      user_id: userId,
      tenant_id: tenant.id,
      display_name: fullName,
      phone,
    });

    // =========================
    // 🔥 ACTIVE TENANT
    // =========================
    await supabaseAdmin.from("user_active_tenant").insert({
      user_id: userId,
      tenant_id: tenant.id,
    });

    // =========================
    // 🔥 AUTO LOGIN (IMPORTANT)
    // =========================
    const supabase = await createSupabaseServerClient();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return NextResponse.json(
        { error: "User creat dar login a eșuat" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redirect: "/admin",
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}