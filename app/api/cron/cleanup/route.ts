import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function GET() {
  const supabase = createSupabasePublicClient();

  await supabase
    .from("bookings")
    .delete()
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  return NextResponse.json({ success: true });
}