import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addMinutesToTime, timesOverlap } from "@/lib/schedule/time";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const body = await req.json();

  const {
    id,
    client_name,
    client_phone,
    barber_service_id,
    date,
    start_time,
  } = body;

  if (!id || !date || !start_time) {
    return Response.json({ error: "Date lipsă" }, { status: 400 });
  }

  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", barber_service_id)
    .single();

  const duration = service?.duration || 30;
  const end_time = addMinutesToTime(start_time, duration);

  const { data: existing } = await supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("date", date)
    .neq("id", id)
    .in("status", ["confirmed", "pending"]);

  const overlap = existing?.some((booking) =>
    timesOverlap(start_time, end_time, booking.start_time, booking.end_time)
  );

  if (overlap) {
    return Response.json({ error: "Slot ocupat" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      client_name,
      client_phone,
      barber_service_id,
      date,
      start_time,
      end_time,
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "Update eșuat" }, { status: 400 });
  }

  return Response.json({ success: true });
}
