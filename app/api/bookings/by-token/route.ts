import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = supabaseAdmin;
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json(
      { error: "Missing token" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("id, client_name, date, start_time, status")
    .eq("cancel_token", token)
    .eq("status", "confirmed")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Link invalid" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}