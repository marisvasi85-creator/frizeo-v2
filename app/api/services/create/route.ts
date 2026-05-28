import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const body = await req.json();

  const { barber_id, display_name, price, duration } = body;

  const { data, error } = await supabase
    .from("barber_services")
    .insert({
      barber_id,
      display_name,
      price: price ?? null,
      duration,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}