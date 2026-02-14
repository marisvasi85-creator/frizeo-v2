import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date"); // 👈 EXISTĂ în schema ta

  if (!barberId || !date) {
    return NextResponse.json(
      { error: "Missing barberId or date" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)           // 👈 COLOANĂ REALĂ
    .order("start_time");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data ?? []);
}
