import {
  bookingCalendarIcsUrl,
  buildBookingIcs,
  buildClientBookingCalendarEvent,
  googleCalendarUrl,
  type BookingCalendarEvent,
} from "@/lib/calendar/bookingCalendar";

export type ClientCalendarLinks = {
  event: BookingCalendarEvent;
  icsContent: string;
  googleUrl: string;
  icsUrl: string;
};

/** Build ICS + Google/download links for client confirmation emails. */
export function buildClientCalendarLinks(input: {
  bookingId: string;
  serviceName: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
  cancelToken: string;
  locationAddress?: string | null;
  notes?: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
}): ClientCalendarLinks {
  const event = buildClientBookingCalendarEvent({
    bookingId: input.bookingId,
    serviceName: input.serviceName,
    barberName: input.barberName,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    locationAddress: input.locationAddress,
    notes: input.notes,
    cancelUrl: input.cancelUrl,
    rescheduleUrl: input.rescheduleUrl,
  });

  return {
    event,
    icsContent: buildBookingIcs(event),
    googleUrl: googleCalendarUrl(event),
    icsUrl: bookingCalendarIcsUrl(input.cancelToken),
  };
}
