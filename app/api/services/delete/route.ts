import { NextResponse } from "next/server";
import {
  assertServiceAccess,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { catalogDeletePatch } from "@/lib/services/catalog";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

    const access = await assertServiceAccess(auth, id);
    if (!access.ok) {
      return access.response;
    }

    const { data: service, error: loadError } = await supabaseAdmin
      .from("barber_services")
      .select("id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 400 });
    }

    if (!service) {
      return NextResponse.json({ error: "Serviciu inexistent" }, { status: 404 });
    }

    if (service.deleted_at) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from("barber_services")
      .update(catalogDeletePatch())
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
