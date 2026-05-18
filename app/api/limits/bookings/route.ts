import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const supabase = createSupabasePublicClient();

  // 🔥 plan
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .single();

  const { data: plan } = await supabase
    .from("plans")
    .select("max_bookings_per_month")
    .eq("id", sub?.plan_id)
    .single();

  const limit = plan?.max_bookings_per_month ?? null;

  // 🔥 count
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .gte("created_at", startOfMonth.toISOString());

  return NextResponse.json({
    used: count || 0,
    limit,
  });
}