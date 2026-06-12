import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

import { sendEmail } from "@/lib/email/email";
import { barberInvitationTemplate } from "@/lib/email/templates/barber-invitation";

export async function POST(req: Request) {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      full_name,
      email,
      phone,
    } = body;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    // tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", barber.tenant_id)
      .single();

    // token nou
const token = crypto.randomUUID();

// verificăm dacă există invitație activă
const { data: existingInvite } =
  await supabaseAdmin
    .from("barber_invitations")
    .select("id")
    .eq("tenant_id", barber.tenant_id)
    .eq("email", email)
    .eq("accepted", false)
    .maybeSingle();

if (existingInvite) {
  const { error } = await supabaseAdmin
    .from("barber_invitations")
    .update({
      token,
      full_name,
      phone,
    })
    .eq("id", existingInvite.id);

  if (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Nu s-a putut actualiza invitația" },
      { status: 400 }
    );
  }
} else {
  const { error } = await supabaseAdmin
    .from("barber_invitations")
    .insert({
      tenant_id: barber.tenant_id,
      full_name,
      email,
      phone,
      token,
    });

  if (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Nu s-a putut salva invitația" },
      { status: 400 }
    );
  }
}

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const inviteUrl =
      `${baseUrl}/invite/${token}`;

    await sendEmail({
      to: email,
      subject: "Invitație Frizeo",
      html: barberInvitationTemplate({
        barberName: full_name,
        salonName:
          tenant?.name || "Salon",
        inviteUrl,
      }),
    });

    return NextResponse.json({
      success: true,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}