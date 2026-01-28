import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "Missing barberId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("barber_day_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .order("date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabase
    .from("barber_day_overrides")
    .insert(body);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
