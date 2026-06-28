import { supabaseAdmin } from "@/lib/supabase/admin";

type ActiveBarberResult =
  | { ok: true; barber: { id: string; tenant_id: string; active: boolean } }
  | { ok: false; error: string; status: number };

export async function requireActiveBarberForNewBooking(
  barberId: string
): Promise<ActiveBarberResult> {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, active")
    .eq("id", barberId)
    .maybeSingle();

  if (!barber) {
    return { ok: false, error: "Frizer inexistent", status: 404 };
  }

  if (!barber.active) {
    return {
      ok: false,
      error:
        "Frizerul este inactiv. Activează-l din Frizeri pentru a crea programări noi.",
      status: 403,
    };
  }

  return { ok: true, barber };
}

export async function allowBarberScheduling(
  barberId: string,
  opts?: { excludeBookingId?: string | null }
): Promise<ActiveBarberResult> {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, active")
    .eq("id", barberId)
    .maybeSingle();

  if (!barber) {
    return { ok: false, error: "Frizer inexistent", status: 404 };
  }

  if (barber.active) {
    return { ok: true, barber };
  }

  if (opts?.excludeBookingId) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, barber_id")
      .eq("id", opts.excludeBookingId)
      .maybeSingle();

    if (booking?.barber_id === barberId) {
      return { ok: true, barber };
    }
  }

  return {
    ok: false,
    error:
      "Frizerul este inactiv. Activează-l din Frizeri pentru a crea programări noi.",
    status: 403,
  };
}
