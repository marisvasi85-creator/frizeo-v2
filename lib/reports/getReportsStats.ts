import type { TenantRole } from "@/lib/auth/tenantRole";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReportsRangePreset } from "@/lib/reports/dateRange";
import { resolveReportsDateRange } from "@/lib/reports/dateRange";

export type ReportsBreakdownRow = {
  id: string;
  name: string;
  total: number;
  confirmed: number;
  cancelled: number;
  pending: number;
};

export type ReportsStats = {
  range: ReportsRangePreset;
  from: string;
  to: string;
  rangeLabel: string;
  scope: "salon" | "barber";
  metrics: {
    total: number;
    confirmed: number;
    cancelled: number;
    pending: number;
    uniqueClients: number;
    estimatedRevenueRon: number | null;
  };
  byBarber: ReportsBreakdownRow[] | null;
  byService: ReportsBreakdownRow[];
};

type BookingRow = {
  id: string;
  status: string;
  barber_id: string | null;
  barber_service_id: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_name: string | null;
};

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return phone.replace(/\s/g, "").replace(/^0/, "40");
}

function clientKey(row: BookingRow): string | null {
  const phone = normalizePhone(row.client_phone);
  if (phone) return `p:${phone}`;
  const email = row.client_email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  const name = row.client_name?.trim().toLowerCase();
  if (name) return `n:${name}`;
  return null;
}

function emptyBucket(id: string, name: string): ReportsBreakdownRow {
  return {
    id,
    name,
    total: 0,
    confirmed: 0,
    cancelled: 0,
    pending: 0,
  };
}

function bump(row: ReportsBreakdownRow, status: string) {
  row.total += 1;
  if (status === "confirmed") row.confirmed += 1;
  else if (status === "cancelled") row.cancelled += 1;
  else if (status === "pending") row.pending += 1;
}

export async function getReportsStats(params: {
  userId: string;
  tenantId: string;
  role: TenantRole;
  range: ReportsRangePreset;
}): Promise<{ stats: ReportsStats | null; error: string | null }> {
  const { from, to, label } = resolveReportsDateRange(params.range);
  const salonWide = params.role === "owner" || params.role === "manager";

  let barberIds: string[] = [];

  if (params.role === "barber") {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("user_id", params.userId)
      .eq("tenant_id", params.tenantId)
      .maybeSingle();

    if (!barber) {
      return { stats: null, error: "Nu am găsit profilul de frizer." };
    }
    barberIds = [barber.id];
  } else {
    const { data: tenantBarbers } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", params.tenantId);

    barberIds = (tenantBarbers ?? []).map((b) => b.id);
  }

  if (barberIds.length === 0) {
    return {
      stats: {
        range: params.range,
        from,
        to,
        rangeLabel: label,
        scope: salonWide ? "salon" : "barber",
        metrics: {
          total: 0,
          confirmed: 0,
          cancelled: 0,
          pending: 0,
          uniqueClients: 0,
          estimatedRevenueRon: null,
        },
        byBarber: salonWide ? [] : null,
        byService: [],
      },
      error: null,
    };
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, status, barber_id, barber_service_id, client_phone, client_email, client_name",
    )
    .gte("date", from)
    .lte("date", to);

  if (salonWide) {
    query = query.or(
      `tenant_id.eq.${params.tenantId},and(tenant_id.is.null,barber_id.in.(${barberIds.join(",")}))`,
    );
  } else {
    query = query.eq("barber_id", barberIds[0]);
  }

  const { data: bookings, error } = await query.limit(5000);

  if (error) {
    console.error("getReportsStats:", error);
    return { stats: null, error: "Nu am putut încărca statisticile." };
  }

  const rows = (bookings ?? []) as BookingRow[];

  const serviceIds = [
    ...new Set(
      rows
        .map((r) => r.barber_service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const usedBarberIds = [
    ...new Set(
      rows.map((r) => r.barber_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: services }, { data: barbers }] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("barber_services")
          .select("id, display_name, name, price")
          .in("id", serviceIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            display_name: string | null;
            name: string | null;
            price: number | null;
          }>,
        }),
    usedBarberIds.length
      ? supabaseAdmin
          .from("barbers")
          .select("id, display_name")
          .in("id", usedBarberIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; display_name: string | null }>,
        }),
  ]);

  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));
  const barberById = new Map((barbers ?? []).map((b) => [b.id, b]));

  let confirmed = 0;
  let cancelled = 0;
  let pending = 0;
  let estimatedRevenueRon = 0;
  let hasPricedConfirmed = false;
  const unique = new Set<string>();
  const byBarberMap = new Map<string, ReportsBreakdownRow>();
  const byServiceMap = new Map<string, ReportsBreakdownRow>();

  for (const row of rows) {
    if (row.status === "confirmed") confirmed += 1;
    else if (row.status === "cancelled") cancelled += 1;
    else if (row.status === "pending") pending += 1;

    if (row.status !== "pending") {
      const key = clientKey(row);
      if (key) unique.add(key);
    }

    if (row.status === "confirmed" && row.barber_service_id) {
      const service = serviceById.get(row.barber_service_id);
      if (service?.price != null && Number.isFinite(Number(service.price))) {
        estimatedRevenueRon += Number(service.price);
        hasPricedConfirmed = true;
      }
    }

    if (salonWide && row.barber_id) {
      const barber = barberById.get(row.barber_id);
      const bucket =
        byBarberMap.get(row.barber_id) ??
        emptyBucket(
          row.barber_id,
          barber?.display_name?.trim() || "Frizer",
        );
      bump(bucket, row.status);
      byBarberMap.set(row.barber_id, bucket);
    }

    if (row.barber_service_id) {
      const service = serviceById.get(row.barber_service_id);
      const bucket =
        byServiceMap.get(row.barber_service_id) ??
        emptyBucket(
          row.barber_service_id,
          service?.display_name || service?.name || "Serviciu",
        );
      bump(bucket, row.status);
      byServiceMap.set(row.barber_service_id, bucket);
    }
  }

  const sortRows = (list: ReportsBreakdownRow[]) =>
    [...list].sort(
      (a, b) =>
        b.confirmed - a.confirmed ||
        b.total - a.total ||
        a.name.localeCompare(b.name, "ro"),
    );

  return {
    stats: {
      range: params.range,
      from,
      to,
      rangeLabel: label,
      scope: salonWide ? "salon" : "barber",
      metrics: {
        total: rows.length,
        confirmed,
        cancelled,
        pending,
        uniqueClients: unique.size,
        estimatedRevenueRon: hasPricedConfirmed ? estimatedRevenueRon : null,
      },
      byBarber: salonWide ? sortRows([...byBarberMap.values()]) : null,
      byService: sortRows([...byServiceMap.values()]),
    },
    error: null,
  };
}
