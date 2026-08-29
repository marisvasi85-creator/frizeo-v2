type BookingRow = Record<string, unknown> & {
  id: string;
};

export type ConfirmPendingHoldInput = {
  bookingId: string;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  client_notes?: string | null;
};

export type ConfirmPendingHoldResult<T extends BookingRow = BookingRow> =
  | { ok: true; booking: T; didConfirm: boolean }
  | { ok: false; booking: null; didConfirm: false; error: unknown };

/**
 * Confirm a pending hold exactly once. Concurrent retries of the same hold
 * return the existing confirmed row with `didConfirm: false` so callers skip
 * a second email/SMS/Google event.
 */
export async function confirmPendingHold<T extends BookingRow = BookingRow>(
  // Supabase query builder is a long fluent chain; callers pass the admin client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: ConfirmPendingHoldInput,
  now = new Date(),
): Promise<ConfirmPendingHoldResult<T>> {
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_email: input.client_email || null,
      client_notes: input.client_notes ?? null,
    })
    .eq("id", input.bookingId)
    .eq("status", "pending")
    .gt("expires_at", now.toISOString())
    .select()
    .single();

  if (data) {
    return { ok: true, booking: data as T, didConfirm: true };
  }

  const { data: existing } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (existing) {
    return { ok: true, booking: existing as T, didConfirm: false };
  }

  return { ok: false, booking: null, didConfirm: false, error };
}
