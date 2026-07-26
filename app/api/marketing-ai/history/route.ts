import { NextResponse } from "next/server";
import {
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { listMarketingAIHistory } from "@/lib/marketing-ai/history";

export async function GET(req: Request) {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitParam) ? limitParam : 20;

  let barberId: string | null | undefined;

  if (auth.role === "barber") {
    barberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
    if (!barberId) {
      return NextResponse.json({ error: "Frizer negăsit" }, { status: 403 });
    }
  }

  const items = await listMarketingAIHistory({
    tenantId: auth.tenantId,
    barberId,
    limit,
  });

  return NextResponse.json({ items });
}
