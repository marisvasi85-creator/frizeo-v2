import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  isValidEmail,
  isValidPassword,
  mapAuthError,
  normalizeEmail,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";
import { getPlanIdBySlug } from "@/lib/billing/getPlanIdBySlug";
import { PLAN_SLUGS } from "@/lib/billing/plans";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone, acceptedTerms } = await req.json();

    const name = (fullName || "").trim();
    const emailNorm = normalizeEmail(email || "");
    const phoneNorm = (phone || "").trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Introdu numele complet." },
        { status: 400 }
      );
    }

    if (!isValidEmail(emailNorm)) {
      return NextResponse.json({ error: "Email invalid." }, { status: 400 });
    }

    if (!phoneNorm || phoneNorm.replace(/\D/g, "").length < 6) {
      return NextResponse.json(
        { error: "Introdu un număr de telefon valid." },
        { status: 400 }
      );
    }

    if (!isValidPassword(password || "")) {
      return NextResponse.json(
        { error: PASSWORD_REQUIREMENTS_MESSAGE },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        {
          error:
            "Trebuie să accepți termenii și condițiile și politica de confidențialitate.",
        },
        { status: 400 }
      );
    }

    const { supabase, getResponse } = await createSupabaseRouteHandlerClient(
      () =>
        NextResponse.json({
          success: true,
          redirect: "/admin/dashboard",
        })
    );

    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: mapAuthError(error?.message) },
        { status: 400 }
      );
    }

    const userId = data.user.id;

    await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: name,
      phone: phoneNorm,
    });

    const tenantSlug = `${name}-salon`
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const barberSlug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    // =========================
    // 🔥 TENANT
    // =========================
    const { data: tenant } = await supabaseAdmin
  .from("tenants")
  .insert({
    name: name + " Salon",
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
    display_name: name,
    phone: phoneNorm,
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

const proPlusPlanId =
  (await getPlanIdBySlug(PLAN_SLUGS.PRO_PLUS)) ??
  (await getPlanIdBySlug(PLAN_SLUGS.FREE));

if (!proPlusPlanId) {
  return NextResponse.json(
    { error: "Configurare planuri incompletă. Contactează suportul." },
    { status: 500 }
  );
}

await supabaseAdmin
  .from("subscriptions")
  .insert({
    tenant_id: tenant.id,
    plan_id: proPlusPlanId,
    status: "trialing",
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnds.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
  });

await supabaseAdmin.from("notification_settings").insert({
  tenant_id: tenant.id,
  booking_email_enabled: true,
  booking_sms_enabled: true,
  reminder_email_enabled: true,
  reminder_sms_enabled: true,
  reschedule_email_enabled: true,
  reschedule_sms_enabled: true,
  cancel_email_enabled: true,
  cancel_sms_enabled: true,
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

    return getResponse();

  } catch (e: any) {
    return NextResponse.json(
      { error: mapAuthError(e.message) },
      { status: 500 }
    );
  }
}