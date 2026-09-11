/**
 * Expired pending holds still occupy unique_booking_slot until their
 * status changes. Slot generation already ignores them, so the hour
 * looks free while a new hold fails. Cancel those rows before insert.
 */
export async function reclaimExpiredHolds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: {
    barberId: string;
    date: string;
    now?: Date;
  },
): Promise<void> {
  const now = input.now ?? new Date();

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("barber_id", input.barberId)
    .eq("date", input.date)
    .eq("status", "pending")
    .lt("expires_at", now.toISOString());

  if (error) {
    console.error("RECLAIM EXPIRED HOLDS ERROR:", error);
  }
}
