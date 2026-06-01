import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const {
      barber_id,
      name,
      display_name,
      duration,
      price,
      show_price,
      featured,
      tenant_id,
    } = body;

    if (!barber_id || !name || !duration) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    if (!ALLOWED_DURATIONS.includes(duration)) {
      return NextResponse.json(
        { error: "Durată invalidă" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("barber_services")
      .insert({
        barber_id,
        name,
        display_name: display_name || name,
        duration,
        price: price || null,
        show_price: show_price ?? true,
        featured: featured ?? false,
        tenant_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ service: data });

  } catch (err) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}