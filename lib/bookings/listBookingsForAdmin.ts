import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TenantRole } from "@/lib/auth/tenantRole";

type RawBookingRow = Record<string, unknown> & {
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

async function enrichBookings(bookings: RawBookingRow[]) {
  if (bookings.length === 0) return [];

  const serviceIds = [
    ...new Set(
      bookings
        .map((b) => b.barber_service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const barberIds = [
    ...new Set(
      bookings
        .map((b) => b.barber_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [servicesResult, barbersResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("barber_services")
          .select("id, display_name, name, duration")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; name: string; duration: number }[] }),
    barberIds.length
      ? supabaseAdmin
          .from("barbers")
          .select("id, display_name")
          .in("id", barberIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);

  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const barbersById = new Map(
    (barbersResult.data ?? []).map((barber) => [barber.id, barber]),
  );

  return bookings.map((row) => {
    const { barbers, barber_services, ...rest } = row;
    const embeddedService = Array.isArray(barber_services)
      ? barber_services[0]
      : barber_services;
    const embeddedBarber = Array.isArray(barbers) ? barbers[0] : barbers;

    return {
      ...rest,
      barber_services:
        embeddedService ??
        (row.barber_service_id
          ? servicesById.get(row.barber_service_id) ?? null
          : null),
      barber:
        embeddedBarber ??
        (row.barber_id ? barbersById.get(row.barber_id) ?? null : null),
    };
  });
}

export async function listBookingsForAdmin(params: {
  userId: string;
  tenantId: string;
  role: TenantRole;
}) {
  let barberIdFilter: string | null = null;

  if (params.role === "barber") {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("user_id", params.userId)
      .eq("tenant_id", params.tenantId)
      .maybeSingle();

    if (!barber) {
      return { bookings: [], error: null as string | null };
    }
    barberIdFilter = barber.id;
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, tenant_id, barber_id, barber_service_id, date, start_time, end_time, status, client_name, client_phone, client_email, client_notes, reschedule_token, cancel_token",
    )
    .neq("status", "cancelled");

  if (barberIdFilter) {
    query = query.eq("barber_id", barberIdFilter);
  } else {
    const { data: tenantBarbers } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", params.tenantId);

    const barberIds = (tenantBarbers ?? []).map((b) => b.id);

    if (barberIds.length > 0) {
      query = query.or(
        `tenant_id.eq.${params.tenantId},and(tenant_id.is.null,barber_id.in.(${barberIds.join(",")}))`,
      );
    } else {
      query = query.eq("tenant_id", params.tenantId);
    }
  }

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    return { bookings: [], error: error.message };
  }

  const bookings = await enrichBookings((data ?? []) as RawBookingRow[]);
  return { bookings, error: null as string | null };
}

export async function listBarbersForAdmin(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name, active")
    .eq("tenant_id", tenantId)
    .order("display_name");

  if (error) {
    return { barbers: [] as { id: string; display_name: string; active?: boolean }[], error: error.message };
  }

  return {
    barbers: (data ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name,
      active: row.active,
    })),
    error: null as string | null,
  };
}
