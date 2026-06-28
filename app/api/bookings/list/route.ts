import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

type BookingRow = Record<string, unknown> & {
  id: string;
  barber_id?: string | null;
  barber_service_id?: string | null;
  barbers?: { display_name?: string } | null;
  barber_services?: {
    display_name?: string;
    name?: string;
    duration?: number;
  } | null;
};

async function enrichBookings(bookings: BookingRow[]) {
  if (bookings.length === 0) {
    return [];
  }

  const serviceIds = [
    ...new Set(
      bookings
        .map((b) => b.barber_service_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const barberIds = [
    ...new Set(
      bookings
        .map((b) => b.barber_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [servicesResult, barbersResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("barber_services")
          .select("id, display_name, name, duration")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] }),
    barberIds.length
      ? supabaseAdmin
          .from("barbers")
          .select("id, display_name")
          .in("id", barberIds)
      : Promise.resolve({ data: [] }),
  ]);

  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service])
  );

  const barbersById = new Map(
    (barbersResult.data ?? []).map((barber) => [barber.id, barber])
  );

  return bookings.map((row) => {
    const { barbers, barber_services, ...rest } = row;

    const embeddedService = Array.isArray(barber_services)
      ? barber_services[0]
      : barber_services;

    const embeddedBarber = Array.isArray(barbers) ? barbers[0] : barbers;

    const service =
      embeddedService ??
      (row.barber_service_id
        ? servicesById.get(row.barber_service_id) ?? null
        : null);

    const barber =
      embeddedBarber ??
      (row.barber_id ? barbersById.get(row.barber_id) ?? null : null);

    return {
      ...rest,
      barber_services: service,
      barber,
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
    .select("*")
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

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("bookings/list:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = await enrichBookings((data ?? []) as BookingRow[]);

  return NextResponse.json({ bookings });
}
