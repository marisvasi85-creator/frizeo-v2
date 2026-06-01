import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const {
      id,
      name,
      display_name,
      duration,
      price,
      show_price,
      featured,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    if (duration && !ALLOWED_DURATIONS.includes(duration)) {
      return NextResponse.json(
        { error: "Durată invalidă" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("barber_services")
      .update({
        name,
        display_name,
        duration,
        price,
        show_price,
        featured,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ service: data });

  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}