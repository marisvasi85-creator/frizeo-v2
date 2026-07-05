import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canCreateBarber } from "@/lib/limits/checkBarberLimit";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const { barberId, active } = body;

    if (!barberId || typeof active !== "boolean") {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }

    const barberOk = await barberBelongsToTenant(
      supabaseAdmin,
      barberId,
      auth.tenantId
    );

    if (!barberOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (active) {
      const allowed = await canCreateBarber(auth.tenantId);

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

    const { error } = await supabaseAdmin
      .from("barbers")
      .update({ active })
      .eq("id", barberId)
      .eq("tenant_id", auth.tenantId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
