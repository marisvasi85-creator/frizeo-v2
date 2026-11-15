import { dpaAcceptanceEnabled, dpaAcceptanceResponse, DPA_DRAFT_VERSION } from "@/lib/dpa/acceptance";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  const enabled = dpaAcceptanceEnabled(process.env);
  let requestedTenantId: string | null = null;
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { tenantId?: unknown } | null;
    requestedTenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  }
  const session = enabled ? await getAdminSession() : null;
  return dpaAcceptanceResponse({
    enabled,
    method: request.method,
    requestedTenantId,
    session: session?.user
      ? { userId: session.user.id, role: session.role, tenantId: session.tenantId }
      : null,
    read: async (tenantId) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("salon_dpa_acceptances")
        .select("document_version")
        .eq("tenant_id", tenantId)
        .eq("document_version", DPA_DRAFT_VERSION)
        .maybeSingle();
      return !error && Boolean(data);
    },
    record: async (tenantId, userId) => {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.from("salon_dpa_acceptances").insert({
        tenant_id: tenantId,
        document_version: DPA_DRAFT_VERSION,
        accepted_by: userId,
      });
      return !error || error.code === "23505";
    },
  });
}

export async function GET(request: Request) {
  const result = await respond(request);
  return Response.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const result = await respond(request);
  return Response.json(result.body, { status: result.status });
}
