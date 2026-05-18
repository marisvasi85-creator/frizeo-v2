import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return Response.json([]);
  }

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("barber_services")
    .select("id, name, duration")
    .eq("barber_id", barberId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return Response.json(data || []);
}