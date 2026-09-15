import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ANONYMIZED_BARBER_UNAVAILABLE_MESSAGE,
  canBarberGeneratePublicSlots,
  canBarberReceiveNewBookings,
} from "@/lib/barbers/schedulableBarber";

type BarberRow = {
  id: string;
  tenant_id: string;
  active: boolean;
  user_id: string | null;
};

type ActiveBarberResult =
  | { ok: true; barber: BarberRow }
  | { ok: false; error: string; status: number };

async function loadBarber(barberId: string): Promise<BarberRow | null> {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, active, user_id")
    .eq("id", barberId)
    .maybeSingle();
  return (barber as BarberRow | null) ?? null;
}

export async function requireActiveBarberForNewBooking(
  barberId: string
): Promise<ActiveBarberResult> {
  const barber = await loadBarber(barberId);

  if (!barber) {
    return { ok: false, error: "Frizer inexistent", status: 404 };
  }

  if (!canBarberReceiveNewBookings(barber)) {
    return {
      ok: false,
      error: barber.user_id
        ? "Frizerul este inactiv. Activează-l din Frizeri pentru a crea programări noi."
        : ANONYMIZED_BARBER_UNAVAILABLE_MESSAGE,
      status: 403,
    };
  }

  return { ok: true, barber };
}

export async function allowBarberScheduling(
  barberId: string,
  opts?: { excludeBookingId?: string | null }
): Promise<ActiveBarberResult> {
  const barber = await loadBarber(barberId);

  if (!barber) {
    return { ok: false, error: "Frizer inexistent", status: 404 };
  }

  let bookingBarberId: string | null = null;
  if (opts?.excludeBookingId) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, barber_id")
      .eq("id", opts.excludeBookingId)
      .maybeSingle();
    bookingBarberId = booking?.barber_id ?? null;
  }

  if (
    canBarberGeneratePublicSlots(barber, {
      excludeBookingId: opts?.excludeBookingId,
      bookingBarberId,
    })
  ) {
    return { ok: true, barber };
  }

  return {
    ok: false,
    error: barber.user_id
      ? "Frizerul este inactiv. Activează-l din Frizeri pentru a crea programări noi."
      : ANONYMIZED_BARBER_UNAVAILABLE_MESSAGE,
    status: 403,
  };
}
