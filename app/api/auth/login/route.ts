import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  isValidEmail,
  mapAuthError,
  normalizeEmail,
} from "@/lib/auth/credentials";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!isValidEmail(email || "")) {
      return NextResponse.json({ error: "Email invalid." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json(
        { error: "Parola este obligatorie." },
        { status: 400 }
      );
    }

    const { supabase, getResponse } = await createSupabaseRouteHandlerClient(
      () => NextResponse.json({ success: true })
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: mapAuthError(error?.message) },
        { status: 400 }
      );
    }

    const { data: memberships } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", data.user.id);

    const ownerTenant = memberships?.find((m) => m.role === "owner");
    const managerTenant = memberships?.find((m) => m.role === "manager");
    const preferredTenantId =
      ownerTenant?.tenant_id ??
      managerTenant?.tenant_id ??
      memberships?.[0]?.tenant_id;

    if (preferredTenantId) {
      await supabase.from("user_active_tenant").upsert({
        user_id: data.user.id,
        tenant_id: preferredTenantId,
      });
    } else {
      const { data: barber } = await supabase
        .from("barbers")
        .select("tenant_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (barber?.tenant_id) {
        await supabase.from("user_active_tenant").upsert({
          user_id: data.user.id,
          tenant_id: barber.tenant_id,
        });
      }
    }

    return getResponse();
  } catch {
    return NextResponse.json(
      { error: "Eroare server. Încearcă din nou." },
      { status: 500 }
    );
  }
}
