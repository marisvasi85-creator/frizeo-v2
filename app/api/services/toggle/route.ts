import { NextResponse } from "next/server";
import {
  assertServiceAccess,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import {
  CATALOG_SERVICE_DELETED_MESSAGE,
  isDeletedFromCatalog,
} from "@/lib/services/catalog";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const access = await assertServiceAccess(auth, id);
    if (!access.ok) {
      return access.response;
    }

    const { data: existing } = await supabaseAdmin
      .from("barber_services")
      .select("deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (isDeletedFromCatalog(existing)) {
      return NextResponse.json(
        { error: CATALOG_SERVICE_DELETED_MESSAGE },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("barber_services")
      .update({ active: Boolean(active) })
      .eq("id", id)
      .is("deleted_at", null)
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
