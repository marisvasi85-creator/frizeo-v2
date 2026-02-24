import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    if (!barberId || !date) {
      return NextResponse.json(
        { error: "Missing barberId or date" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        date,
        start_time,
        end_time,
        client_name,
        client_phone,
        client_email,
        status,
        service_id
      `)
      .eq("barber_id", barberId)
      .eq("date", date)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (error) {
      console.error("LIST BOOKINGS ERROR:", error);
      return NextResponse.json(
        { error: "Could not fetch bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("LIST ROUTE ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}