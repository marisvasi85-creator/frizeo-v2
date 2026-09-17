export function isBookingNotificationOutboxEnabled(): boolean {
  const value = process.env.BOOKING_NOTIFICATION_OUTBOX_ENABLED
    ?.trim()
    .toLowerCase();
  return value === "true" || value === "1";
}
