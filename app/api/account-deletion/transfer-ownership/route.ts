import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { transferTenantOwnership } from "@/lib/account-deletion/ownership";
import { accountDeletionWriteBlockResponse } from "@/lib/account-deletion/runtimeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const blocked = accountDeletionWriteBlockResponse();
  if (blocked) return blocked;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenantId?: unknown; toUserId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const toUserId = typeof body.toUserId === "string" ? body.toUserId : "";
  if (!tenantId || !toUserId) {
    return NextResponse.json(
      { error: "Selectează salonul și membrul care preia ownership-ul." },
      { status: 400 },
    );
  }

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const result = await transferTenantOwnership({
    tenantId,
    toUserId,
    fromUserId: user.id,
    hasBarberRow: Boolean(barber?.id),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
