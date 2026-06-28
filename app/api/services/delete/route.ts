import { NextResponse } from "next/server";
import {
  assertServiceAccess,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const access = await assertServiceAccess(auth, id);
    if (!access.ok) {
      return access.response;
    }

    const { error } = await supabaseAdmin
      .from("barber_services")
      .delete()
      .eq("id", id);

    if (error) {
      const message =
        error.code === "23503"
          ? "Serviciul nu poate fi șters — există programări asociate. Dezactivează-l în loc."
          : error.message;

      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
