import { createSupabaseServerClient } from "@/lib/supabase/server";

// 🔥 helper corect
function toMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

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

  // 🔥 serviciu (durata)
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", barber_service_id)
    .single();

  const duration = service?.duration || 30;

  // 🔥 calcul corect end_time
  const startMin = toMinutes(start_time);
  const endMin = startMin + duration;

  const end_time = minutesToTime(endMin);

  // 🔥 bookings existente
  const { data: existing } = await supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("date", date)
    .neq("id", id)
    .in("status", ["confirmed", "pending"]);

  // 🔥 overlap CORECT (numeric)
  const overlap = existing?.some((b: any) => {
    const bStart = toMinutes(b.start_time);
    const bEnd = toMinutes(b.end_time);

    return startMin < bEnd && endMin > bStart;
  });

  if (overlap) {
    return Response.json({ error: "Slot ocupat" }, { status: 400 });
  }

  // 🔥 update
  const { error } = await supabase
    .from("bookings")
    .update({
      client_name,
      client_phone,
      barber_service_id,
      date,
      start_time: minutesToTime(startMin),
      end_time,
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: "Update eșuat" }, { status: 400 });
  }

  return Response.json({ success: true });
}