import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json(
      { error: "Missing barberId" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("barber_services")
    .select(`
      id,
      service_id,
      price,
      duration,
      active,
      services (
        name
      )
    `)
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data);
}
