import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("barber_services")
      .update({ active })
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