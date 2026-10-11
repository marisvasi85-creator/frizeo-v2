import { reserveGraphCall, type GraphBudget } from "@/lib/integrations/meta/graph";
import { graphErrorCode, type GraphCall, type GraphResult } from "@/lib/integrations/meta/publish/graphHttp";
import {
  INSTAGRAM_PUBLISH_SCOPES,
  type ProviderOutcome,
} from "@/lib/integrations/meta/publish/outcome";

const NUMERIC_ID = /^[0-9]{1,32}$/;

export type InstagramStatus =
  | { kind: "no_budget" }
  | { kind: "timeout" }
  | { kind: "in_progress" }
  | { kind: "finished" }
  | { kind: "error" }
  | { kind: "expired" }
  | { kind: "published" }
  | { kind: "unknown" };

function failed(safeError: ProviderOutcome["safeError"]): ProviderOutcome {
  return {
    status: "failed",
    providerPostId: null,
    providerContainerId: null,
    safeError,
  };
}

function missingScopes(scopes: readonly string[]): boolean {
  return INSTAGRAM_PUBLISH_SCOPES.some((scope) => !scopes.includes(scope));
}

function definite(result: Exclude<GraphResult, { timeout: true }>): ProviderOutcome | null {
  const code = graphErrorCode(result.body);
  if (code === 190) return failed("token_expired");
  if (code === 200 || code === 10) return failed("missing_permission");
  if (!result.ok && result.status >= 400 && result.status < 500 && code != null) {
    return failed("provider_error");
  }
  return null;
}

export async function createInstagramContainer(input: {
  igUserId: string;
  userToken: string;
  scopes: readonly string[];
  imageUrl: string;
  caption: string;
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
}): Promise<ProviderOutcome> {
  if (missingScopes(input.scopes)) return failed("missing_permission");
  if (!NUMERIC_ID.test(input.igUserId)) return failed("invalid_parameter");
  if (!input.imageUrl.startsWith("https://")) return failed("invalid_image");
  const timeoutMs = reserveGraphCall(input.budget);
  if (timeoutMs == null) return failed("timeout");
  const created = await input.http({
    method: "POST",
    path: `${input.igUserId}/media`,
    form: { image_url: input.imageUrl, caption: input.caption },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in created) {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  const failure = definite(created);
  if (failure) return failure;
  if (!created.ok || !created.body || typeof created.body !== "object") {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  const id = (created.body as { id?: unknown }).id;
  if (typeof id !== "string" || !NUMERIC_ID.test(id)) {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  return {
    status: "publishing",
    providerPostId: null,
    providerContainerId: id,
    safeError: null,
  };
}

export async function readInstagramStatus(input: {
  containerId: string;
  userToken: string;
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
}): Promise<InstagramStatus> {
  if (!NUMERIC_ID.test(input.containerId)) return { kind: "unknown" };
  const timeoutMs = reserveGraphCall(input.budget);
  if (timeoutMs == null) return { kind: "no_budget" };
  const status = await input.http({
    method: "GET",
    path: input.containerId,
    query: { fields: "status_code" },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in status) return { kind: "timeout" };
  if (!status.ok || !status.body || typeof status.body !== "object") return { kind: "unknown" };
  const code = (status.body as { status_code?: unknown }).status_code;
  if (code === "IN_PROGRESS") return { kind: "in_progress" };
  if (code === "FINISHED") return { kind: "finished" };
  if (code === "ERROR") return { kind: "error" };
  if (code === "EXPIRED") return { kind: "expired" };
  if (code === "PUBLISHED") return { kind: "published" };
  return { kind: "unknown" };
}

export async function publishInstagramContainer(input: {
  igUserId: string;
  containerId: string;
  userToken: string;
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
}): Promise<ProviderOutcome> {
  if (!NUMERIC_ID.test(input.igUserId) || !NUMERIC_ID.test(input.containerId)) {
    return failed("invalid_parameter");
  }
  const timeoutMs = reserveGraphCall(input.budget);
  if (timeoutMs == null) {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: "awaiting_publish_confirmation",
    };
  }
  const published = await input.http({
    method: "POST",
    path: `${input.igUserId}/media_publish`,
    form: { creation_id: input.containerId },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in published) {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: "ambiguous",
    };
  }
  const failure = definite(published);
  if (failure) {
    return { ...failure, providerContainerId: input.containerId };
  }
  if (!published.ok || !published.body || typeof published.body !== "object") {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: "ambiguous",
    };
  }
  const id = (published.body as { id?: unknown }).id;
  if (typeof id !== "string" || !NUMERIC_ID.test(id)) {
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: "ambiguous",
    };
  }
  return {
    status: "published",
    providerPostId: id,
    providerContainerId: input.containerId,
    safeError: null,
  };
}
