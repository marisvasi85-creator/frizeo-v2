import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOOKING_SELECT = `
  *,
  barber_services (
    display_name,
    name,
    duration
  ),
  barbers (
    display_name
  )
`;

function mapBookings(data: Record<string, unknown>[] | null) {
  return (data ?? []).map((row) => {
    const { barbers, ...rest } = row as typeof row & {
      barbers?: { display_name?: string } | null;
    };

    return {
      ...rest,
      barber: barbers ?? null,
    };
  });
}

export async function GET() {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);

  if (isAuthError(auth)) {
    return auth;
  }

  let barberIdFilter: string | null = null;

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

    barberIdFilter = barber.id;
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(BOOKING_SELECT)
    .neq("status", "cancelled");

  if (barberIdFilter) {
    query = query.eq("barber_id", barberIdFilter);
  } else {
    const { data: tenantBarbers } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", auth.tenantId);

    const barberIds = (tenantBarbers ?? []).map((b) => b.id);

    if (barberIds.length > 0) {
      query = query.or(
        `tenant_id.eq.${auth.tenantId},and(tenant_id.is.null,barber_id.in.(${barberIds.join(",")}))`
      );
    } else {
      query = query.eq("tenant_id", auth.tenantId);
    }
  }

  let { data, error } = await query
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("bookings/list embed:", error);

    let plainQuery = supabaseAdmin
      .from("bookings")
      .select("*")
      .neq("status", "cancelled");

    if (barberIdFilter) {
      plainQuery = plainQuery.eq("barber_id", barberIdFilter);
    } else {
      plainQuery = plainQuery.eq("tenant_id", auth.tenantId);
    }

    ({ data, error } = await plainQuery
      .order("date", { ascending: false })
      .order("start_time", { ascending: false }));
  }

  if (error) {
    console.error("bookings/list:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings: mapBookings(data) });
}
