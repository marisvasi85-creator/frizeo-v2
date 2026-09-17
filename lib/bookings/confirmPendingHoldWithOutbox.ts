import { supabaseAdmin } from "@/lib/supabase/admin";

type BookingRow = Record<string, unknown> & { id: string };

type RpcPayload<T extends BookingRow> = {
  booking?: T;
  didConfirm?: boolean;
};

export function isMissingBookingNotificationOutboxSchema(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return (
    value?.code === "PGRST202" ||
    value?.code === "42883" ||
    value?.message?.includes("confirm_public_booking_with_outbox") === true
  );
}

export async function confirmPendingHoldWithOutbox<T extends BookingRow>(input: {
  bookingId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientNotes?: string | null;
}): Promise<
  | { ok: true; booking: T; didConfirm: boolean }
  | { ok: false; booking: null; didConfirm: false; error: unknown }
> {
  const { data, error } = await supabaseAdmin.rpc(
    "confirm_public_booking_with_outbox",
    {
      p_booking_id: input.bookingId,
      p_client_name: input.clientName,
      p_client_phone: input.clientPhone,
      p_client_email: input.clientEmail || null,
      p_client_notes: input.clientNotes ?? null,
    },
  );

  const payload = data as RpcPayload<T> | null;
  if (error || !payload?.booking) {
    return { ok: false, booking: null, didConfirm: false, error };
  }

  return {
    ok: true,
    booking: payload.booking,
    didConfirm: payload.didConfirm === true,
  };
}
