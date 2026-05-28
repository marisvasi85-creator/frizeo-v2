import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .neq("status", "cancelled");

  if (error) {
    console.error("BOOKINGS ERROR:", error);
    return Response.json({ bookings: [] });
  }

  console.log("BOOKINGS DB:", data);

  return Response.json({
    bookings: data || [],
  });
}