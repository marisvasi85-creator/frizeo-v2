import { supabase } from "@/lib/supabase/server";
import RescheduleClient from "./components/RescheduleClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ReschedulePage({ params }: Props) {
  const { token } = await params; // ✅ OBLIGATORIU

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("reschedule_token", token)
    .eq("status", "confirmed")
    .single();

  if (!booking || error) {
    return <p>Programare invalidă sau expirată</p>;
  }

  return (
    <RescheduleClient
  barberId={booking.barber_id}
  bookingId={booking.id}
  token={token}
/>

  );
}
