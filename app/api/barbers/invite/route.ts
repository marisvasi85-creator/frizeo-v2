import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";
import { canInviteBarber } from "@/lib/limits/checkBarberLimit";

import { sendEmail } from "@/lib/email/email";
import { barberInvitationTemplate } from "@/lib/email/templates/barber-invitation";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);

    if (isAuthError(auth)) {
      return auth;
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

    const tenantId = auth.tenantId;

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const token = crypto.randomUUID();

    const { data: existingInvite } =
      await supabaseAdmin
        .from("barber_invitations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .eq("accepted", false)
        .maybeSingle();

    if (!existingInvite) {
      const allowed = await canInviteBarber(tenantId);

      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "Ai atins limita de frizeri pentru planul tău. Upgrade abonamentul pentru mai mulți frizeri.",
          },
          { status: 403 }
        );
      }
    }

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
      tenant_id: tenantId,
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

    const baseUrl = getAppUrl();

    const inviteUrl =
  `${baseUrl}/accept-invite/${token}`;

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