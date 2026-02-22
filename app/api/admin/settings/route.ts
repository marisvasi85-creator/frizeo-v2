import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/settings
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
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

/**
 * POST /api/admin/settings
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const body = await req.json();

  const { error } = await supabase
    .from("barber_settings")
    .update({
      slot_duration_minutes: body.slot_duration_minutes,
      break_between_minutes: body.break_between_minutes,
      cancel_limit_hours: body.cancel_limit_hours,
    });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
