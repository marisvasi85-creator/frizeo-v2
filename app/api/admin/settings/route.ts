import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("barber_settings")
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabaseServer
    .from("barber_settings")
    .update({
      slot_duration_minutes: body.slot_duration_minutes,
      break_between_minutes: body.break_between_minutes,
      cancel_limit_hours: body.cancel_limit_hours,
    })
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
