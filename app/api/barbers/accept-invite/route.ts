import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { canCreateBarber } from "@/lib/limits/checkBarberLimit";

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

    // verifică dacă emailul există deja
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

    // create auth user
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

    // profile
    await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        full_name:
          invitation.full_name,
        phone:
          invitation.phone || null,
      });

    // tenant user
    await supabaseAdmin
      .from("tenant_users")
      .insert({
        user_id: userId,
        tenant_id:
          invitation.tenant_id,
        role: "barber",
      });

    // barber
    await supabaseAdmin
      .from("barbers")
      .insert({
        user_id: userId,
        tenant_id:
          invitation.tenant_id,
        display_name:
          invitation.full_name,
        phone:
          invitation.phone || null,
        active: true,
      });

    // active tenant
    await supabaseAdmin
      .from("user_active_tenant")
      .insert({
        user_id: userId,
        tenant_id:
          invitation.tenant_id,
      });

    // accepted
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