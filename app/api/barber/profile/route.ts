import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ profile: null });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("barbers")
    .select(`
      id,
      display_name,
      tenant:tenants (
        name
      )
    `)
    .eq("id", barberId)
    .single();

  if (error || !data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile: data });
}