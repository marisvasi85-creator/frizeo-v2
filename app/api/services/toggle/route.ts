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
    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const serviceOk = await serviceBelongsToTenant(
      auth.supabase,
      id,
      auth.tenantId
    );

    if (!serviceOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("barber_services")
      .update({ active })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
