import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";
import {
  asBookingAccessMode,
  canBookForAccess,
  type BookingAccessMode,
  type ClientAccessStatus,
  type PublicAccessResult,
} from "./types";

export { publicAccessMessage } from "./types";

type BarberAccessRow = {
  id: string;
  tenant_id: string;
  active: boolean | null;
  booking_access_mode?: string | null;
};

export function isMissingBarberAccessSchema(error: {
  code?: string | null;
  message?: string | null;
} | null): boolean {
  if (!error) return false;

  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    Boolean(
      error.message?.includes("booking_access_mode") ||
        error.message?.includes("barber_client_access") ||
        error.message?.includes("barber_existing_clients"),
    )
  );
}

export async function getBarberAccessMode(
  barberId: string,
): Promise<{
  barber: BarberAccessRow | null;
  mode: BookingAccessMode;
  schemaReady: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, active, booking_access_mode")
    .eq("id", barberId)
    .maybeSingle();

  if (error && isMissingBarberAccessSchema(error)) {
    const { data: legacyBarber } = await supabaseAdmin
      .from("barbers")
      .select("id, tenant_id, active")
      .eq("id", barberId)
      .maybeSingle();

    return {
      barber: legacyBarber as BarberAccessRow | null,
      mode: "open",
      schemaReady: false,
    };
  }

  if (error) {
    throw error;
  }

  const barber = data as BarberAccessRow | null;
  return {
    barber,
    mode: asBookingAccessMode(barber?.booking_access_mode),
    schemaReady: true,
  };
}

export async function getBarberAccessModes(
  barberIds: string[],
): Promise<Record<string, BookingAccessMode>> {
  const fallback = Object.fromEntries(
    barberIds.map((id) => [id, "open" as BookingAccessMode]),
  );

  if (barberIds.length === 0) return fallback;

  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, booking_access_mode")
    .in("id", barberIds);

  if (error && isMissingBarberAccessSchema(error)) return fallback;
  if (error) throw error;

  for (const row of data ?? []) {
    fallback[row.id] = asBookingAccessMode(row.booking_access_mode);
  }

  return fallback;
}

export async function checkBarberBookingAccess(input: {
  barberId: string;
  phone: string;
}): Promise<PublicAccessResult & { tenantId: string | null; schemaReady: boolean }> {
  const { barber, mode, schemaReady } = await getBarberAccessMode(
    input.barberId,
  );

  if (!barber || barber.active !== true) {
    return {
      accessMode: mode,
      status: "not_found",
      canBook: false,
      tenantId: barber?.tenant_id ?? null,
      schemaReady,
    };
  }

  if (mode === "open") {
    return {
      accessMode: mode,
      status: "approved",
      canBook: true,
      tenantId: barber.tenant_id,
      schemaReady,
    };
  }

  const phoneNormalized = normalizeRomanianPhone(input.phone);
  if (!phoneNormalized) {
    return {
      accessMode: mode,
      status: "invalid_phone",
      canBook: false,
      tenantId: barber.tenant_id,
      schemaReady,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("barber_client_access")
    .select("status")
    .eq("tenant_id", barber.tenant_id)
    .eq("barber_id", input.barberId)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (error) throw error;

  const status = (data?.status as ClientAccessStatus | undefined) ?? "not_found";
  return {
    accessMode: mode,
    status,
    canBook: canBookForAccess(mode, status),
    tenantId: barber.tenant_id,
    schemaReady,
  };
}
