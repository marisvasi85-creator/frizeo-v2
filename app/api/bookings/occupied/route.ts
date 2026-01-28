import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("barber_id", barberId)
    .eq("booking_date", date);

  if (error) {
    return NextResponse.json([]);
  }

  return NextResponse.json(data.map(b => b.booking_time));
}
