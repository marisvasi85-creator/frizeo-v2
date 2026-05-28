import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // 🔥 ia durata serviciului
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", barber_service_id)
    .single();

  const duration = service?.duration || 30;

  // 🔥 calculează end_time
  const [h, m] = start_time.split(":").map(Number);
  const end = new Date();
  end.setHours(h);
  end.setMinutes(m + duration);

  const end_time = end.toTimeString().slice(0, 5);

  // 🔥 UPDATE
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
    return Response.json({ error: "Update failed" }, { status: 400 });
  }

  return Response.json({ success: true });
}