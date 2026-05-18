import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutes);
  return d.toTimeString().slice(0, 5);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (!barberId || !date || !serviceId) {
    return NextResponse.json([]);
  }

  const supabase = createSupabasePublicClient();

  const normalizedDate = new Date(date).toISOString().split("T")[0];

  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", serviceId)
    .single();

  const duration = service?.duration || 30;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("start_time, end_time, status, expires_at")
    .eq("barber_id", barberId)
    .eq("date", normalizedDate);

  const now = new Date();

  const activeBookings = (bookings || []).filter((b: any) => {
    if (b.status === "confirmed") return true;
    if (b.status === "pending" && b.expires_at) {
      return new Date(b.expires_at) > now;
    }
    return false;
  });

  const start = "09:00";
  const end = "18:00";

  let slots: string[] = [];
  let current = start;

  while (current < end) {
    const slotEnd = addMinutes(current, duration);

    const overlaps = activeBookings.some((b: any) => {
      return current < b.end_time && slotEnd > b.start_time;
    });

    if (!overlaps) {
      slots.push(current);
    }

    current = addMinutes(current, 15);
  }

  return NextResponse.json(slots);
}