import { NextResponse } from "next/server";
import {
  assertServiceAccess,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const { id, name, display_name, duration, price, show_price, featured } =
      body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (duration && !ALLOWED_DURATIONS.includes(duration)) {
      return NextResponse.json({ error: "Durată invalidă" }, { status: 400 });
    }

    const access = await assertServiceAccess(auth, id);
    if (!access.ok) {
      return access.response;
    }

    const { data, error } = await supabaseAdmin
      .from("barber_services")
      .update({
        name,
        display_name,
        duration,
        price,
        show_price,
        featured,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
