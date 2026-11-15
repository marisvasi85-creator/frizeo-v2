import { DPA_VERSION } from "@/lib/dpa/document";

export const DPA_ACCEPTANCE_METHOD = "electronic_dashboard";

export type DpaSession = {
  userId: string;
  role: string | null;
  tenantId: string | null;
};

export type DpaIdentity = {
  legalName: string;
  cui: string;
  address: string;
  representativeName: string;
  representativeConfirmed: boolean;
};

export type DpaProof = {
  accepted: boolean;
  acceptedAt: string | null;
  documentHash: string | null;
  legalName: string | null;
  representativeName: string | null;
  method: string | null;
};

const LIMITS = {
  legalName: [2, 200],
  cui: [2, 32],
  address: [5, 300],
  representativeName: [2, 200],
} as const;

export function normalizeDpaIdentity(input: DpaIdentity): DpaIdentity | null {
  const legalName = input.legalName.trim();
  const cui = input.cui.trim();
  const address = input.address.trim();
  const representativeName = input.representativeName.trim();
  const fields = { legalName, cui, address, representativeName };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = fields[key as keyof typeof fields];
    if (value.length < min || value.length > max) return null;
  }
  if (input.representativeConfirmed !== true) return null;
  return { legalName, cui, address, representativeName, representativeConfirmed: true };
}

export async function dpaAcceptanceResponse(input: {
  enabled: boolean;
  method: string;
  session: DpaSession | null;
  requestedTenantId?: string | null;
  accepted?: boolean | null;
  representativeConfirmed?: boolean | null;
  presentedVersion?: string | null;
  presentedHash?: string | null;
  identity?: DpaIdentity | null;
  documentVersion: string;
  documentHash: string;
  read: (tenantId: string) => Promise<DpaProof>;
  record: (
    tenantId: string,
    userId: string,
    documentHash: string,
    identity: DpaIdentity,
  ) => Promise<{ ok: boolean; proof: DpaProof }>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const base = { version: input.documentVersion, hash: input.documentHash };
  if (!input.enabled) {
    return { status: 404, body: { error: "disabled", ...base } };
  }
  if (!input.session?.userId || !input.session.tenantId) {
    return { status: 401, body: { error: "unauthenticated", ...base } };
  }
  if (input.session.role !== "owner") {
    return { status: 403, body: { error: "forbidden", ...base } };
  }
  const tenantId = input.session.tenantId;
  if (input.requestedTenantId && input.requestedTenantId !== tenantId) {
    return { status: 403, body: { error: "tenant", ...base } };
  }
  if (input.method === "GET") {
    const proof = await input.read(tenantId);
    return { status: 200, body: { ...base, ...proof } };
  }
  if (input.method !== "POST") {
    return { status: 405, body: { error: "method", ...base } };
  }
  if (input.accepted !== true || input.representativeConfirmed !== true) {
    return { status: 400, body: { error: "not_accepted", ...base, accepted: false } };
  }
  if (
    input.presentedVersion !== input.documentVersion ||
    input.presentedHash !== input.documentHash ||
    input.documentVersion !== DPA_VERSION
  ) {
    return { status: 409, body: { error: "document", ...base, accepted: false } };
  }
  const existing = await input.read(tenantId);
  if (existing.accepted) {
    return { status: 200, body: { ...base, ...existing, documentHash: existing.documentHash } };
  }
  const identity = input.identity ? normalizeDpaIdentity(input.identity) : null;
  if (!identity) {
    return { status: 400, body: { error: "identity", ...base, accepted: false } };
  }
  const saved = await input.record(tenantId, input.session.userId, input.documentHash, identity);
  if (!saved.ok) {
    return { status: 500, body: { error: "save_failed", ...base, accepted: false } };
  }
  return { status: 200, body: { ...base, ...saved.proof, documentHash: input.documentHash } };
}
