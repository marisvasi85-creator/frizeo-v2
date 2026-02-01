import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing token" },
      { status: 400 }
    );
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("reschedule_token", token)
    .single();

  if (error || !booking) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 404 }
    );
  }

  return NextResponse.json({ booking });
}
