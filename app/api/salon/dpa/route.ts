import { dpaAcceptanceEnabled, dpaAcceptanceResponse } from "@/lib/dpa/acceptance";
import { DPA_DRAFT_VERSION, dpaDocumentHash } from "@/lib/dpa/document";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  const enabled = dpaAcceptanceEnabled(process.env);
  const documentHash = dpaDocumentHash();
  let requestedTenantId: string | null = null;
  let accepted: boolean | null = null;
  let presentedVersion: string | null = null;
  let presentedHash: string | null = null;
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as {
      tenantId?: unknown;
      accepted?: unknown;
      version?: unknown;
      hash?: unknown;
    } | null;
    requestedTenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
    accepted = body?.accepted === true ? true : false;
    presentedVersion = typeof body?.version === "string" ? body.version : null;
    presentedHash = typeof body?.hash === "string" ? body.hash : null;
  }
  const session = enabled ? await getAdminSession() : null;
  return dpaAcceptanceResponse({
    enabled,
    method: request.method,
    requestedTenantId,
    accepted,
    presentedVersion,
    presentedHash,
    documentVersion: DPA_DRAFT_VERSION,
    documentHash,
    session: session?.user
      ? { userId: session.user.id, role: session.role, tenantId: session.tenantId }
      : null,
    read: async (tenantId) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("salon_dpa_acceptances")
        .select("accepted_at, document_hash")
        .eq("tenant_id", tenantId)
        .eq("document_version", DPA_DRAFT_VERSION)
        .maybeSingle();
      if (error || !data) {
        return { accepted: false, acceptedAt: null, documentHash: null };
      }
      return {
        accepted: true,
        acceptedAt: data.accepted_at,
        documentHash: data.document_hash,
      };
    },
    record: async (tenantId, userId, hash) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("salon_dpa_acceptances")
        .insert({
          tenant_id: tenantId,
          document_version: DPA_DRAFT_VERSION,
          document_hash: hash,
          accepted_by: userId,
        })
        .select("accepted_at")
        .single();
      if (!error && data?.accepted_at) {
        return { ok: true, acceptedAt: data.accepted_at };
      }
      if (error?.code !== "23505") return { ok: false, acceptedAt: null };
      const existing = await supabase
        .from("salon_dpa_acceptances")
        .select("accepted_at")
        .eq("tenant_id", tenantId)
        .eq("document_version", DPA_DRAFT_VERSION)
        .maybeSingle();
      return {
        ok: Boolean(existing.data?.accepted_at),
        acceptedAt: existing.data?.accepted_at ?? null,
      };
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
