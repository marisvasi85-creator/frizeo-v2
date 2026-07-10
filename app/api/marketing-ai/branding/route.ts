import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { buildMarketingContext } from "@/lib/marketing-ai/buildContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  let barberId = searchParams.get("barberId");

  if (auth.role === "barber") {
    const currentBarberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
    if (!currentBarberId) {
      return NextResponse.json({ error: "Frizer negăsit" }, { status: 403 });
    }
    barberId = currentBarberId;
  }

  if (!barberId) {
    return NextResponse.json({ error: "barberId lipsă" }, { status: 400 });
  }

  const belongs = await barberBelongsToTenant(
    supabaseAdmin,
    barberId,
    auth.tenantId,
  );
  if (!belongs) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const context = await buildMarketingContext(auth.tenantId, barberId);
  if (!context) {
    return NextResponse.json({ error: "Date indisponibile" }, { status: 404 });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("logo_url")
    .eq("id", auth.tenantId)
    .maybeSingle();

  return NextResponse.json({
    salonName: context.salonName,
    barberName: context.barberName,
    logoUrl: tenant?.logo_url ?? null,
    bookingUrl: context.bookingUrl,
  });
}
