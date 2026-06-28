import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);

  if (isAuthError(auth)) {
    return NextResponse.json({ bookings: [] }, { status: 401 });
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      `
      *,
      barber_services (
        display_name,
        name,
        duration
      ),
      barbers (
        display_name
      )
    `
    )
    .eq("tenant_id", auth.tenantId)
    .neq("status", "cancelled");

  if (auth.role === "barber") {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (!barber) {
      return NextResponse.json({ bookings: [] });
    }

    query = query.eq("barber_id", barber.id);
  }

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("bookings/list:", error);
    return NextResponse.json(
      { bookings: [], error: error.message },
      { status: 500 }
    );
  }

  const bookings = (data ?? []).map((row) => {
    const { barbers, ...rest } = row as typeof row & {
      barbers?: { display_name?: string } | null;
    };

    return {
      ...rest,
      barber: barbers ?? null,
    };
  });

  return NextResponse.json({ bookings });
}
