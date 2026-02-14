import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json(
      { error: "Missing barberId" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("barber_services")
    .select(`
      id,
      duration,
      price,
      display_name,
      sort_order,
      show_price,
      featured,
      services (
        name
      )
    `)
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const normalized = (data ?? []).map((s) => ({
    id: s.id,
    name: s.display_name ?? s.services?.[0]?.name ?? "",
    duration: s.duration,
    price: s.show_price ? s.price : null,
    featured: s.featured ?? false,
  }));

  return NextResponse.json(normalized);
}
