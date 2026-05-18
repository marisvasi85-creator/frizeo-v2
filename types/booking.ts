export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rescheduled";

export type Booking = {
  id: string;
  barber_id: string;
  service_id: string | null;
  barber_service_id: string | null;

  date: string;
  start_time: string;
  end_time: string;

  client_name: string;
  client_phone: string;
  client_email: string | null;

  status: BookingStatus;

  cancel_token: string | null;
  reschedule_token: string | null;

  expires_at: string | null;

  created_at: string;
  updated_at: string;
};