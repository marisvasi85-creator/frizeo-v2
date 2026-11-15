/** Draft identifier. Enabling acceptance does not make this text a signed contract. */
export const DPA_DRAFT_VERSION = "dpa-proiect-2026-11-15";

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

export async function dpaAcceptanceResponse(input: {
  enabled: boolean;
  method: string;
  session: DpaSession | null;
  requestedTenantId?: string | null;
  read: (tenantId: string) => Promise<boolean>;
  record: (tenantId: string, userId: string) => Promise<boolean>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!input.enabled) {
    return { status: 404, body: { error: "disabled", documentStatus: "draft" } };
  }
  if (!input.session?.userId || !input.session.tenantId) {
    return { status: 401, body: { error: "unauthenticated", documentStatus: "draft" } };
  }
  if (input.session.role !== "owner") {
    return { status: 403, body: { error: "forbidden", documentStatus: "draft" } };
  }
  const tenantId = input.session.tenantId;
  if (input.requestedTenantId && input.requestedTenantId !== tenantId) {
    return { status: 403, body: { error: "tenant", documentStatus: "draft" } };
  }
  if (input.method === "GET") {
    const accepted = await input.read(tenantId);
    return {
      status: 200,
      body: {
        documentStatus: "draft",
        version: DPA_DRAFT_VERSION,
        accepted,
      },
    };
  }
  if (input.method !== "POST") {
    return { status: 405, body: { error: "method", documentStatus: "draft" } };
  }
  const saved = await input.record(tenantId, input.session.userId);
  if (!saved) return { status: 500, body: { error: "save_failed", documentStatus: "draft" } };
  return {
    status: 200,
    body: { documentStatus: "draft", version: DPA_DRAFT_VERSION, accepted: true },
  };
}
