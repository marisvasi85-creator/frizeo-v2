import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone } = await req.json();

    const supabase = await createSupabaseServerClient();

    // 🔥 SIGNUP + LOGIN AUTOMAT (IMPORTANT)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Signup failed" },
        { status: 400 }
      );
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
    
const trialEnds = new Date();
trialEnds.setDate(trialEnds.getDate() + 15);

await supabaseAdmin
  .from("subscriptions")
  .insert({
    tenant_id: tenant.id,
    plan_id:
      "1bc6a7ca-f1a1-4b7a-812b-aeacbcdaed93", // Free

    status: "trialing",

    current_period_start:
      new Date().toISOString(),

    current_period_end:
      trialEnds.toISOString(),

    trial_ends_at:
      trialEnds.toISOString(),
  });

    // 🔥 REDIRECT FINAL
    return NextResponse.json({
      success: true,
      redirect: "/admin/dashboard",
    });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}