import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const body = await req.json();

  const {
    barber_id,
    break_between_enabled,
    break_between_minutes,
  } = body;

  if (!barber_id) {
    return NextResponse.json(
      { error: "Missing barber_id" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("barber_settings")
    .update({
      break_between_enabled,
      break_between_minutes,
    })
    .eq("barber_id", barber_id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}