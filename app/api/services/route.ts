import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return Response.json({ services: [] });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
  .from("barber_services")
  .select("id, display_name, duration, price")
  .eq("barber_id", barberId)
  .eq("active", true) // 🔥 AICI
  .order("sort_order", { ascending: true });

  if (error) {
    console.error("SERVICES ERROR:", error);
    return Response.json({ services: [] });
  }

  return Response.json({
    services: data || [],
  });
}