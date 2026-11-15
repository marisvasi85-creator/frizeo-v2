import { dpaAcceptanceEnabledForTenant } from "@/lib/dpa/access";
import {
  dpaAcceptanceResponse,
  type DpaIdentity,
  type DpaProof,
} from "@/lib/dpa/acceptance";
import { DPA_VERSION, dpaDocumentHash } from "@/lib/dpa/document";
import { isStaging, hostnameFromRequest } from "@/lib/app/environment";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function proofFromRow(row: {
  accepted_at: string;
  document_hash: string | null;
  salon_legal_name: string | null;
  representative_name: string | null;
  acceptance_method: string | null;
} | null): DpaProof {
  if (!row) {
    return {
      accepted: false,
      acceptedAt: null,
      documentHash: null,
      legalName: null,
      representativeName: null,
      method: null,
    };
  }
  return {
    accepted: true,
    acceptedAt: row.accepted_at,
    documentHash: row.document_hash,
    legalName: row.salon_legal_name,
    representativeName: row.representative_name,
    method: row.acceptance_method,
  };
}

async function respond(request: Request) {
  const session = await getAdminSession();
  const enabled = dpaAcceptanceEnabledForTenant({
    tenantId: session?.tenantId ?? null,
    hostname: hostnameFromRequest(request),
    stagingRuntime: isStaging(),
  });
  const documentHash = dpaDocumentHash();
  let requestedTenantId: string | null = null;
  let accepted: boolean | null = null;
  let representativeConfirmed: boolean | null = null;
  let presentedVersion: string | null = null;
  let presentedHash: string | null = null;
  let identity: DpaIdentity | null = null;
  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    requestedTenantId = text(body?.tenantId) || null;
    accepted = body?.accepted === true;
    representativeConfirmed = body?.representativeConfirmed === true;
    presentedVersion = text(body?.version) || null;
    presentedHash = text(body?.hash) || null;
    identity = {
      legalName: text(body?.legalName),
      cui: text(body?.cui),
      address: text(body?.address),
      representativeName: text(body?.representativeName),
      representativeConfirmed: body?.representativeConfirmed === true,
    };
  }
  return dpaAcceptanceResponse({
    enabled,
    method: request.method,
    requestedTenantId,
    accepted,
    representativeConfirmed,
    presentedVersion,
    presentedHash,
    identity,
    documentVersion: DPA_VERSION,
    documentHash,
    session: session?.user
      ? { userId: session.user.id, role: session.role, tenantId: session.tenantId }
      : null,
    read: async (tenantId) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("salon_dpa_acceptances")
        .select("accepted_at, document_hash, salon_legal_name, representative_name, acceptance_method")
        .eq("tenant_id", tenantId)
        .eq("document_version", DPA_VERSION)
        .maybeSingle();
      if (error) return proofFromRow(null);
      return proofFromRow(data);
    },
    record: async (tenantId, userId, hash, savedIdentity) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("salon_dpa_acceptances")
        .insert({
          tenant_id: tenantId,
          document_version: DPA_VERSION,
          document_hash: hash,
          accepted_by: userId,
          salon_legal_name: savedIdentity.legalName,
          salon_cui: savedIdentity.cui,
          salon_address: savedIdentity.address,
          representative_name: savedIdentity.representativeName,
          representative_confirmed: true,
          acceptance_method: "electronic_dashboard",
        })
        .select("accepted_at, document_hash, salon_legal_name, representative_name, acceptance_method")
        .single();
      if (!error && data) return { ok: true, proof: proofFromRow(data) };
      if (error?.code !== "23505") return { ok: false, proof: proofFromRow(null) };
      const existing = await supabase
        .from("salon_dpa_acceptances")
        .select("accepted_at, document_hash, salon_legal_name, representative_name, acceptance_method")
        .eq("tenant_id", tenantId)
        .eq("document_version", DPA_VERSION)
        .maybeSingle();
      return { ok: Boolean(existing.data), proof: proofFromRow(existing.data) };
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
