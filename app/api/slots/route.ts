import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getAvailableSlots } from "@/lib/scheduling/getAvailableSlots";

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

  // 🔥 SERVICE (duration)
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", serviceId)
    .single();

  const duration = service?.duration || 30;

  // 🔥 BOOKINGS
  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select("start_time, end_time, status, expires_at")
    .eq("barber_id", barberId)
    .eq("date", normalizedDate);

  const now = new Date();

  const bookings =
    (bookingsRaw || [])
      .filter((b: any) => {
        if (b.status === "confirmed") return true;
        if (b.status === "pending" && b.expires_at) {
          return new Date(b.expires_at) > now;
        }
        return false;
      })
      .map((b: any) => ({
        // 🔥 IMPORTANT: transformare în ISO
        start_time: new Date(
          `${normalizedDate}T${b.start_time}`
        ).toISOString(),
        end_time: new Date(
          `${normalizedDate}T${b.end_time}`
        ).toISOString(),
      }));

  // 🔥 WEEKLY SCHEDULE
  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barberId);

  // 🔥 OVERRIDES
  const { data: overrides } = await supabase
    .from("barber_day_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", normalizedDate);

  // 🔥 ENGINE REAL
  const slots = getAvailableSlots({
    date: normalizedDate,
    duration,
    bookings,
    schedule: schedule || [],
    overrides: overrides || [],
  });

  return NextResponse.json(slots);
}