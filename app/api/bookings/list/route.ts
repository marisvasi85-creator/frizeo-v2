import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("❌ NO USER");
    return Response.json({ bookings: [] });
  }

  const { data: barber } = await supabase
    .from("barbers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!barber) {
    console.log("❌ NO BARBER");
    return Response.json({ bookings: [] });
  }

  // 🔥 FIX IMPORTANT AICI
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      barber_services:barber_services!bookings_barber_service_id_fkey (
  display_name,
  name,
  duration
)
    `)
    .eq("barber_id", barber.id)
    .neq("status", "cancelled")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    console.error("❌ BOOKINGS ERROR:", error);
    return Response.json({ bookings: [] });
  }

  console.log("🔥 BOOKINGS FIXED:", data);

  return Response.json({
    bookings: data || [],
  });
}