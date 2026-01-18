import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Services API error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data);
}
