import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("bookings")
    .select("id, client_name, start_time, date")
    .eq("date", today)
    .eq("status", "confirmed")
    .order("start_time");

  return Response.json({
    bookings: data || [],
  });
}