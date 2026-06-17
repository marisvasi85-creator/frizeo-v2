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

    const tenantSlug =
  `${fullName}-salon`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const barberSlug =
  fullName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
    // =========================
    // 🔥 TENANT
    // =========================
    const { data: tenant } = await supabaseAdmin
  .from("tenants")
  .insert({
    name: fullName + " Salon",
    slug: tenantSlug,
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
    const { data: barber } = await supabaseAdmin
  .from("barbers")
  .insert({
    user_id: userId,
    tenant_id: tenant.id,
    display_name: fullName,
    phone,
    slug: barberSlug,
  })
  .select()
  .single();

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

  // =========================
// ✂️ SERVICII IMPLICITE
// =========================

await supabaseAdmin
  .from("barber_services")
  .insert([
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      display_name: "Tuns",
      name: "Tuns",
      duration: 45,
      price: 50,
      active: true,
      featured: true,
      sort_order: 1,
      show_price: true,
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      display_name: "Barbă",
      name: "Barbă",
      duration: 30,
      price: 30,
      active: true,
      featured: false,
      sort_order: 2,
      show_price: true,
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      display_name: "Tuns + Barbă",
      name: "Tuns + Barbă",
      duration: 60,
      price: 70,
      active: true,
      featured: true,
      sort_order: 3,
      show_price: true,
    },
  ]);

  // =========================
// 📅 PROGRAM IMPLICIT
// =========================

await supabaseAdmin
  .from("barber_weekly_schedule")
  .insert([
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 1,
      is_working: true,
      work_start: "09:00",
      work_end: "18:00",
      break_enabled: true,
      break_start: "13:00",
      break_end: "14:00",
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 2,
      is_working: true,
      work_start: "09:00",
      work_end: "18:00",
      break_enabled: true,
      break_start: "13:00",
      break_end: "14:00",
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 3,
      is_working: true,
      work_start: "09:00",
      work_end: "18:00",
      break_enabled: true,
      break_start: "13:00",
      break_end: "14:00",
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 4,
      is_working: true,
      work_start: "09:00",
      work_end: "18:00",
      break_enabled: true,
      break_start: "13:00",
      break_end: "14:00",
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 5,
      is_working: true,
      work_start: "09:00",
      work_end: "18:00",
      break_enabled: true,
      break_start: "13:00",
      break_end: "14:00",
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 6,
      is_working: true,
      work_start: "09:00",
      work_end: "14:00",
      break_enabled: false,
    },
    {
      barber_id: barber.id,
      tenant_id: tenant.id,
      day_of_week: 7,
      is_working: false,
      break_enabled: false,
    },
  ]);

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