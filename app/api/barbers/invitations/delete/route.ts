import { NextResponse } from "next/server";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const { invitationId } = await req.json();

    if (!invitationId) {
      return NextResponse.json({ error: "Invitație invalidă" }, { status: 400 });
    }

    const { data: invitation } = await supabaseAdmin
      .from("barber_invitations")
      .select("id, tenant_id, accepted")
      .eq("id", invitationId)
      .maybeSingle();

    if (!invitation || invitation.tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: "Invitație inexistentă" }, { status: 404 });
    }

    if (invitation.accepted) {
      return NextResponse.json(
        { error: "Invitația a fost deja acceptată și nu poate fi ștearsă" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("barber_invitations")
      .delete()
      .eq("id", invitationId);

    if (error) {
      console.error("invitations/delete:", error);
      return NextResponse.json(
        { error: "Nu s-a putut șterge invitația" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
