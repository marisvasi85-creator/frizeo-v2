import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("barbers")
      .select("id, display_name")
      .order("display_name");

    if (error) {
      console.error("BARBERS FETCH ERROR:", error);
      return NextResponse.json({ barbers: [] }, { status: 500 });
    }

    return NextResponse.json({
      barbers: data || [],
    });

  } catch (err) {
    console.error("BARBERS API ERROR:", err);
    return NextResponse.json({ barbers: [] }, { status: 500 });
  }
}