import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  activeBarberLimitReachedMessage,
  canCreateBarber,
  getBarberLimitState,
} from "@/lib/limits/checkBarberLimit";
import { allocateBarberSlug } from "@/lib/barbers/allocateBarberSlug";
import {
  barberInviteExpiredMessage,
  isBarberInviteExpired,
} from "@/lib/barbers/inviteExpiry";
import {
  isValidPassword,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/lib/auth/credentials";
import { enforceRateLimit } from "@/lib/security/rateLimit";

// ===================================
// GET INVITATION
// ===================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token lipsă" },
        { status: 400 }
      );
    }

    const { data: invitation } =
      await supabaseAdmin
        .from("barber_invitations")
        .select(`
          id,
          full_name,
          email,
          phone,
          accepted,
          created_at
        `)
        .eq("token", token)
        .single();

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitație inexistentă" },
        { status: 404 }
      );
    }

    if (invitation.accepted) {
      return NextResponse.json(
        { error: "Invitația a fost deja acceptată" },
        { status: 410 }
      );
    }

    if (isBarberInviteExpired(invitation.created_at)) {
      return NextResponse.json(
        { error: barberInviteExpiredMessage() },
        { status: 410 }
      );
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        full_name: invitation.full_name,
        email: invitation.email,
        phone: invitation.phone,
        accepted: invitation.accepted,
      },
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

// ===================================
// ACCEPT INVITATION
// ===================================
export async function POST(req: Request) {
  try {
    const {
      token,
      password,
    } = await req.json();
    const limited = await enforceRateLimit(req, {
      bucket: "accept-invite",
      identifier: token || "",
      limit: 10,
      windowSeconds: 60 * 60,
    });
    if (limited) return limited;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: PASSWORD_REQUIREMENTS_MESSAGE },
        { status: 400 }
      );
    }

    const { data: invitation } =
      await supabaseAdmin
        .from("barber_invitations")
        .select("*")
        .eq("token", token)
        .eq("accepted", false)
        .single();

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitație invalidă" },
        { status: 400 }
      );
    }

    if (isBarberInviteExpired(invitation.created_at)) {
      return NextResponse.json(
        { error: barberInviteExpiredMessage() },
        { status: 410 }
      );
    }

    const allowed = await canCreateBarber(invitation.tenant_id);

    if (!allowed) {
      const state = await getBarberLimitState(invitation.tenant_id);
      const limit = state?.limit ?? 0;
      return NextResponse.json(
        {
          error: activeBarberLimitReachedMessage(limit),
          code: "BARBER_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    const { data: existingUsers } =
      await supabaseAdmin.auth.admin.listUsers();

    const exists = existingUsers.users.find(
      (u) =>
        u.email?.toLowerCase() ===
        invitation.email.toLowerCase()
    );

    if (exists) {
      return NextResponse.json(
        {
          error:
            "Există deja un cont cu acest email",
        },
        { status: 400 }
      );
    }

    const {
      data: createdUser,
      error: createError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      });

    if (createError || !createdUser.user) {
      console.error(createError);

      return NextResponse.json(
        { error: "Nu s-a putut crea contul" },
        { status: 400 }
      );
    }

    const userId =
      createdUser.user.id;

    await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        full_name:
          invitation.full_name,
        phone:
          invitation.phone || null,
      });

    await supabaseAdmin
      .from("tenant_users")
      .insert({
        user_id: userId,
        tenant_id:
          invitation.tenant_id,
        role: "barber",
      });

    const barberSlug = await allocateBarberSlug(
      invitation.tenant_id,
      invitation.full_name,
    );

    const { data: barber, error: barberError } = await supabaseAdmin
  .from("barbers")
  .insert({
    user_id: userId,
    tenant_id: invitation.tenant_id,
    display_name: invitation.full_name,
    phone: invitation.phone || null,
    active: true,
    slug: barberSlug,
  })
  .select()
  .single();

    if (barberError || !barber) {
      throw barberError ?? new Error("Nu s-a putut crea profilul frizerului.");
    }

    await supabaseAdmin
  .from("barber_services")
  .insert([
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,

      name: "tuns",
      display_name: "Tuns",

      duration: 45,
      price: 60,

      active: true,
      sort_order: 1,
      show_price: true,
      featured: true,
    },

    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,

      name: "tuns-barba",
      display_name: "Tuns + Barbă",

      duration: 60,
      price: 90,

      active: true,
      sort_order: 2,
      show_price: true,
      featured: true,
    },

    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,

      name: "barba",
      display_name: "Barbă",

      duration: 30,
      price: 40,

      active: true,
      sort_order: 3,
      show_price: true,
      featured: false,
    },
  ]);

  await supabaseAdmin
  .from("barber_weekly_schedule")
  .insert([
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,
      day_of_week: 1,
      is_working: true,
      work_start: "09:00",
      work_end: "17:00",
      break_enabled: false,
    },
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,
      day_of_week: 2,
      is_working: true,
      work_start: "09:00",
      work_end: "17:00",
      break_enabled: false,
    },
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,
      day_of_week: 3,
      is_working: true,
      work_start: "09:00",
      work_end: "17:00",
      break_enabled: false,
    },
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,
      day_of_week: 4,
      is_working: true,
      work_start: "09:00",
      work_end: "17:00",
      break_enabled: false,
    },
    {
      barber_id: barber.id,
      tenant_id: invitation.tenant_id,
      day_of_week: 5,
      is_working: true,
      work_start: "09:00",
      work_end: "17:00",
      break_enabled: false,
    },
  ]);
  
    await supabaseAdmin
      .from("user_active_tenant")
      .insert({
        user_id: userId,
        tenant_id:
          invitation.tenant_id,
      });

    await supabaseAdmin
      .from("barber_invitations")
      .update({
        accepted: true,
      })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      email: invitation.email,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
