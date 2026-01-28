import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("active", true)
    .order("duration_minutes");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
