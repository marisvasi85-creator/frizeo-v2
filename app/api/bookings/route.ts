import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Eroare la încărcarea programărilor" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
