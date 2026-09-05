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
import { getTrialDays } from "@/lib/billing/getTrialDays";
import { PLAN_SLUGS } from "@/lib/billing/plans";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { allocateTenantSlug } from "@/lib/tenant/allocateTenantSlug";
import { allocateBarberSlug } from "@/lib/barbers/allocateBarberSlug";
import { recordSignupAndTrialConversions } from "@/lib/frizeo-email/attribution";
import { upsertContactSoft } from "@/lib/frizeo-email/contacts";
import { parseFirstPartyAnalyticsContext } from "@/lib/analytics/serverContext";

export async function POST(req: Request) {
  let createdUserId: string | null = null;
  let createdTenantId: string | null = null;
  let provisioningComplete = false;

  try {
    const {
      email,
      password,
      fullName,
      phone,
      acceptedTerms,
      marketingConsent,
      actsAsBarber,
      businessType,
      analyticsContext: rawAnalyticsContext,
    } = await req.json();
    const analyticsContext = parseFirstPartyAnalyticsContext(rawAnalyticsContext);
    const wantsMarketing = marketingConsent === true;
    const limited = await enforceRateLimit(req, {
      bucket: "auth-signup",
      identifier: normalizeEmail(email || ""),
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (limited) return limited;

    const name = (fullName || "").trim();
    const emailNorm = normalizeEmail(email || "");
    const phoneNorm = (phone || "").trim();

    // independent | salon — legacy clients without businessType stay on salon/Pro+.
    const resolvedBusinessType =
      businessType === "independent" || businessType === "salon"
        ? businessType
        : "salon";
    const ownerActsAsBarber =
      resolvedBusinessType === "independent"
        ? true
        : actsAsBarber !== false;
    const signupPlanSlug =
      resolvedBusinessType === "independent"
        ? PLAN_SLUGS.PRO
        : PLAN_SLUGS.PRO_PLUS;
    const tenantDisplayName =
      resolvedBusinessType === "independent" ? name : `${name} Salon`;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Introdu numele complet." },
        { status: 400 }
      );
    }

    if (businessType != null && businessType !== "independent" && businessType !== "salon") {
      return NextResponse.json(
        { error: "Alege dacă ești frizer independent sau lucrezi într-un salon." },
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

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailNorm,
        password,
        email_confirm: true,
      });

    if (createError || !createdUser.user) {
      return NextResponse.json(
        { error: mapAuthError(createError?.message) },
        { status: 400 }
      );
    }

    const userId = createdUser.user.id;
    createdUserId = userId;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: name,
      phone: phoneNorm,
    });
    if (profileError) throw profileError;

    // Slug-uri stabile la creare. Utilizatorii le pot personaliza ulterior
    // din dashboard; slug-urile vechi rămân ca redirect.
    const tenantSlug = await allocateTenantSlug(tenantDisplayName);
    // =========================
    // 🔥 TENANT
    // =========================
    const { data: tenant, error: tenantError } = await supabaseAdmin
  .from("tenants")
  .insert({
    name: tenantDisplayName,
    slug: tenantSlug,
  })
  .select()
  .single();
    if (tenantError || !tenant) {
      throw tenantError ?? new Error("Nu s-a putut crea salonul.");
    }
    createdTenantId = tenant.id;

    // =========================
    // 🔥 TENANT USER
    // =========================
    const { error: membershipError } = await supabaseAdmin.from("tenant_users").insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: "owner",
    });
    if (membershipError) throw membershipError;

    const barberSlug = await allocateBarberSlug(tenant.id, name);

    // =========================
    // 🔥 BARBER
    // =========================
    const { data: barber, error: barberError } = await supabaseAdmin
  .from("barbers")
  .insert({
    user_id: userId,
    tenant_id: tenant.id,
    display_name: name,
    phone: phoneNorm,
    slug: barberSlug,
    active: ownerActsAsBarber,
  })
  .select()
  .single();
    if (barberError || !barber) {
      throw barberError ?? new Error("Nu s-a putut crea profilul frizerului.");
    }

    // =========================
    // 🔥 ACTIVE TENANT
    // =========================
    const { error: activeTenantError } = await supabaseAdmin.from("user_active_tenant").insert({
      user_id: userId,
      tenant_id: tenant.id,
    });
    if (activeTenantError) throw activeTenantError;
    
const trialEnds = new Date();
trialEnds.setDate(trialEnds.getDate() + getTrialDays());

const signupPlanId =
  (await getPlanIdBySlug(signupPlanSlug)) ??
  (await getPlanIdBySlug(PLAN_SLUGS.FREE));

if (!signupPlanId) {
  return NextResponse.json(
    { error: "Configurare planuri incompletă. Contactează suportul." },
    { status: 500 }
  );
}

const { error: subscriptionError } = await supabaseAdmin
  .from("subscriptions")
  .insert({
    tenant_id: tenant.id,
    plan_id: signupPlanId,
    status: "trialing",
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnds.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
  });
if (subscriptionError) throw subscriptionError;

const { error: notificationError } = await supabaseAdmin.from("notification_settings").insert({
  tenant_id: tenant.id,
  booking_email_enabled: true,
  booking_sms_enabled: false,
  reminder_email_enabled: true,
  reminder_sms_enabled: true,
  reschedule_email_enabled: true,
  reschedule_sms_enabled: false,
  cancel_email_enabled: true,
  cancel_sms_enabled: false,
});
if (notificationError) throw notificationError;
  // =========================
// ✂️ SERVICII IMPLICITE
// =========================

const { error: servicesError } = await supabaseAdmin
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
if (servicesError) throw servicesError;

  // =========================
// 📅 PROGRAM IMPLICIT
// =========================

const { error: scheduleError } = await supabaseAdmin
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
    if (scheduleError) throw scheduleError;
    provisioningComplete = true;

    // Failure-isolated inside the attribution helper; ensure both canonical
    // conversions are persisted before returning the successful signup.
    await recordSignupAndTrialConversions({
      userId,
      tenantId: tenant.id,
      email: emailNorm,
      analyticsContext,
    });

    const nameParts = name.split(/\s+/);
    void upsertContactSoft({
      email: emailNorm,
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(" ") || null,
      phone: phoneNorm,
      source: "frizeo_user",
      marketing_consent: wantsMarketing,
      consent_source: wantsMarketing ? "signup" : null,
      user_id: userId,
      tenant_id: tenant.id,
    }).catch((err) => {
      console.error("SIGNUP MARKETING CONTACT ERROR:", err);
    });

    const { supabase, getResponse } = await createSupabaseRouteHandlerClient(
      () =>
        NextResponse.json({
          success: true,
          redirect: "/admin/dashboard",
        })
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: mapAuthError(signInError.message) },
        { status: 500 }
      );
    }

    return getResponse();

  } catch (e: unknown) {
    if (!provisioningComplete) {
      if (createdTenantId) {
        const { error } = await supabaseAdmin
          .from("tenants")
          .delete()
          .eq("id", createdTenantId);
        if (error) console.error("SIGNUP TENANT ROLLBACK ERROR:", error);
      }

      if (createdUserId) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          createdUserId,
        );
        if (error) console.error("SIGNUP USER ROLLBACK ERROR:", error);
      }
    }

    return NextResponse.json(
      { error: mapAuthError(e instanceof Error ? e.message : undefined) },
      { status: 500 }
    );
  }
}
