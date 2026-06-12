import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { canCreateBarber } from "@/lib/limits/checkBarberLimit";

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
          accepted
        `)
        .eq("token", token)
        .single();

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitație inexistentă" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      invitation,
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

    if (!token || !password) {
      return NextResponse.json(
        { error: "Date incomplete" },
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

    const allowed =
      await canCreateBarber(
        invitation.tenant_id
      );

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Salonul a atins limita planului curent",
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

    const { data: barber } = await supabaseAdmin
  .from("barbers")
  .insert({
    user_id: userId,
    tenant_id: invitation.tenant_id,
    display_name: invitation.full_name,
    phone: invitation.phone || null,
    active: true,
  })
  .select()
  .single();
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