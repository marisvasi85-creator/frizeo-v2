import { DPA_DRAFT_VERSION } from "@/lib/dpa/document";

export { DPA_DRAFT_VERSION };

export function dpaAcceptanceEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return env.DPA_ACCEPTANCE_ENABLED?.trim() === "true";
}

export type DpaSession = {
  userId: string;
  role: string | null;
  tenantId: string | null;
};

export type DpaProof = {
  accepted: boolean;
  acceptedAt: string | null;
  documentHash: string | null;
};

export async function dpaAcceptanceResponse(input: {
  enabled: boolean;
  method: string;
  session: DpaSession | null;
  requestedTenantId?: string | null;
  accepted?: boolean | null;
  presentedVersion?: string | null;
  presentedHash?: string | null;
  documentVersion: string;
  documentHash: string;
  read: (tenantId: string) => Promise<DpaProof>;
  record: (
    tenantId: string,
    userId: string,
    documentHash: string,
  ) => Promise<{ ok: boolean; acceptedAt: string | null }>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const draft = {
    documentStatus: "draft",
    version: input.documentVersion,
    hash: input.documentHash,
  };
  if (!input.enabled) {
    return { status: 404, body: { error: "disabled", ...draft } };
  }
  if (!input.session?.userId || !input.session.tenantId) {
    return { status: 401, body: { error: "unauthenticated", ...draft } };
  }
  if (input.session.role !== "owner") {
    return { status: 403, body: { error: "forbidden", ...draft } };
  }
  const tenantId = input.session.tenantId;
  if (input.requestedTenantId && input.requestedTenantId !== tenantId) {
    return { status: 403, body: { error: "tenant", ...draft } };
  }
  if (input.method === "GET") {
    const proof = await input.read(tenantId);
    return { status: 200, body: { ...draft, ...proof } };
  }
  if (input.method !== "POST") {
    return { status: 405, body: { error: "method", ...draft } };
  }
  if (input.accepted !== true) {
    return { status: 400, body: { error: "not_accepted", ...draft, accepted: false } };
  }
  if (
    input.presentedVersion !== input.documentVersion ||
    input.presentedHash !== input.documentHash
  ) {
    return { status: 409, body: { error: "document", ...draft, accepted: false } };
  }
  const saved = await input.record(tenantId, input.session.userId, input.documentHash);
  if (!saved.ok) {
    return { status: 500, body: { error: "save_failed", ...draft, accepted: false } };
  }
  return {
    status: 200,
    body: {
      ...draft,
      accepted: true,
      acceptedAt: saved.acceptedAt,
      documentHash: input.documentHash,
    },
  };
}
