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