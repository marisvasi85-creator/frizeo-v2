import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
  serviceBelongsToTenant,
} from "@/lib/auth/requireTenantAccess";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const serviceOk = await serviceBelongsToTenant(
      auth.supabase,
      id,
      auth.tenantId
    );

    if (!serviceOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await auth.supabase
      .from("barber_services")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
