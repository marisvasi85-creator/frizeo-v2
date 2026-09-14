import { NextResponse } from "next/server";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ACCOUNT_DELETION_SELECT } from "@/lib/account-deletion/types";

export async function GET() {
  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("account_deletion_requests")
    .select(
      `${ACCOUNT_DELETION_SELECT}, tenants(name, slug)`,
    )
    .order("requested_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("admin account deletion list", error);
    return NextResponse.json(
      { error: "Nu am putut încărca solicitările." },
      { status: 500 },
    );
  }

  const requests = (data ?? []).map((row) => {
    const tenant = row.tenants as { name?: string; slug?: string } | null;
    return {
      ...row,
      tenants: undefined,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
    };
  });

  return NextResponse.json({ requests });
}
