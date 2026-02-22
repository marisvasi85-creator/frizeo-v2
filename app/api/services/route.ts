import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ services: [] });
  }

  const { data } = await supabase
    .from("barber_services")
    .select("id, display_name, duration")
    .eq("barber_id", barberId)
    .order("display_name");

  return NextResponse.json({ services: data || [] });
}