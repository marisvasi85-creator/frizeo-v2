type BookingRow = {
  start_time: string;
  end_time: string;
  status: string;
  expires_at?: string | null;
};

export function getActiveBookings<T extends BookingRow>(
  bookings: T[] | null | undefined,
  now = new Date()
) {
  return (bookings || []).filter((booking) => {
    if (booking.status === "confirmed") return true;

    if (booking.status === "pending" && booking.expires_at) {
      return new Date(booking.expires_at) > now;
    }

    return false;
  });
}
