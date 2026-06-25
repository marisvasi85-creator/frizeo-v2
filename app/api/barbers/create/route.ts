import { NextResponse } from "next/server";
import { canCreateBarber } from "@/lib/limits/checkBarberLimit";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const { tenantId, name, phone } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (tenantId !== auth.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = await canCreateBarber(auth.tenantId);

    if (!allowed) {
      return NextResponse.json(
        { error: "Ai atins limita de frizeri pentru planul tău" },
        { status: 403 }
      );
    }

    const { data, error } = await auth.supabase
      .from("barbers")
      .insert({
        tenant_id: auth.tenantId,
        display_name: name,
        phone: phone || null,
        active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Insert failed" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
