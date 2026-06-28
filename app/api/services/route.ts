import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ services: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("barber_services")
    .select(`
      id,
      name,
      display_name,
      duration,
      price,
      show_price,
      featured,
      active,
      sort_order
    `)
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("SERVICES GET ERROR:", error);
    return NextResponse.json({ services: [] });
  }

  return NextResponse.json({
    services: data || [],
  });
}
