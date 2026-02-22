import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("cancel_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Booking not found" },
      { status: 404 }
    );
  }

  if (data.status === "cancelled") {
    return NextResponse.json(
      { error: "Booking already cancelled" },
      { status: 409 }
    );
  }

  return NextResponse.json(data);
}
