import { reserveGraphCall, type GraphBudget } from "@/lib/integrations/meta/graph";
import { graphErrorCode, type GraphCall, type GraphResult } from "@/lib/integrations/meta/publish/graphHttp";
import {
  INSTAGRAM_PUBLISH_SCOPES,
  type ProviderOutcome,
} from "@/lib/integrations/meta/publish/outcome";
import {
  stageCause,
  stageElapsed,
  stageHttpStatus,
  type PublishStageEvent,
} from "@/lib/integrations/meta/publish/stage";

const NUMERIC_ID = /^[0-9]{1,32}$/;

/** Meta downloads the image while creating the container. That call uses its own request. */
export const INSTAGRAM_CONTAINER_TIMEOUT_MS = 5000;

/** media_publish runs only in a later request, after the container is stored. 1500 ms aborted the live call. */
export const INSTAGRAM_PUBLISH_TIMEOUT_MS = 5000;

type StageNote = (event: PublishStageEvent) => void;

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

function ambiguousPublish(containerId: string): ProviderOutcome {
  return {
    status: "unknown",
    providerPostId: null,
    providerContainerId: containerId,
    safeError: "ambiguous",
  };
}

/** A safe integer survives JSON numbers. A larger Graph id must stay a string; rounding it would store the wrong post. */
function postId(value: unknown): string | null {
  if (typeof value === "string" && NUMERIC_ID.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    const text = String(value);
    return NUMERIC_ID.test(text) ? text : null;
  }
  return null;
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
  note?: StageNote;
}): Promise<ProviderOutcome> {
  if (missingScopes(input.scopes)) return failed("missing_permission");
  if (!NUMERIC_ID.test(input.igUserId)) return failed("invalid_parameter");
  if (!input.imageUrl.startsWith("https://")) return failed("invalid_image");
  const timeoutMs = reserveGraphCall(input.budget, INSTAGRAM_CONTAINER_TIMEOUT_MS);
  if (timeoutMs == null) {
    input.note?.({ stage: "container_create", outcome: "skipped", durationMs: 0, httpStatus: null });
    return failed("timeout");
  }
  const created = await input.http({
    method: "POST",
    path: `${input.igUserId}/media`,
    form: { image_url: input.imageUrl, caption: input.caption },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in created) {
    input.note?.({
      stage: "container_create",
      outcome: stageCause(created),
      durationMs: stageElapsed(created),
      httpStatus: null,
    });
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  const failure = definite(created);
  if (failure) {
    input.note?.({
      stage: "container_create",
      outcome: failure.safeError === "provider_error" ? "provider_error" : "http",
      durationMs: stageElapsed(created),
      httpStatus: stageHttpStatus(created),
    });
    return failure;
  }
  if (!created.ok || !created.body || typeof created.body !== "object") {
    input.note?.({
      stage: "container_create",
      outcome: "ambiguous",
      durationMs: stageElapsed(created),
      httpStatus: stageHttpStatus(created),
    });
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  const id = (created.body as { id?: unknown }).id;
  if (typeof id !== "string" || !NUMERIC_ID.test(id)) {
    input.note?.({
      stage: "container_create",
      outcome: "missing_id",
      durationMs: stageElapsed(created),
      httpStatus: stageHttpStatus(created),
    });
    return {
      status: "unknown",
      providerPostId: null,
      providerContainerId: null,
      safeError: "ambiguous",
    };
  }
  input.note?.({
    stage: "container_create",
    outcome: "created",
    durationMs: stageElapsed(created),
    httpStatus: stageHttpStatus(created),
  });
  return {
    status: "publishing",
    providerPostId: null,
    providerContainerId: id,
    safeError: null,
  };
}

export type InstagramListedPost = {
  id: string;
  caption: string;
  timestamp: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
};

export type InstagramMediaList =
  | { kind: "ok"; posts: InstagramListedPost[] }
  | { kind: "no_budget" | "timeout" | "unknown" | "missing_permission" | "token_expired" | "provider_error" | "invalid" };

function listedId(value: unknown): string | "invalid" | "skip" {
  const id = postId(value);
  if (id) return id;
  if (typeof value === "number") return "invalid";
  if (typeof value === "string" && value.trim() !== "") return "invalid";
  return "skip";
}

/** One authorized read of the newest media. This does not create a container and does not publish. */
export async function listInstagramMedia(input: {
  igUserId: string;
  userToken: string;
  scopes: readonly string[];
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
}): Promise<InstagramMediaList> {
  if (missingScopes(input.scopes)) return { kind: "missing_permission" };
  if (!NUMERIC_ID.test(input.igUserId)) return { kind: "invalid" };
  const timeoutMs = reserveGraphCall(input.budget);
  if (timeoutMs == null) return { kind: "no_budget" };
  const listed = await input.http({
    method: "GET",
    path: `${input.igUserId}/media`,
    query: {
      fields: "id,caption,timestamp,media_type,media_url",
      limit: "25",
    },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in listed) return { kind: "timeout" };
  const failure = definite(listed);
  if (failure?.safeError === "token_expired") return { kind: "token_expired" };
  if (failure?.safeError === "missing_permission") return { kind: "missing_permission" };
  if (failure) return { kind: "provider_error" };
  if (!listed.ok || !listed.body || typeof listed.body !== "object") return { kind: "unknown" };
  const data = (listed.body as { data?: unknown }).data;
  if (!Array.isArray(data)) return { kind: "unknown" };
  const posts: InstagramListedPost[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      id?: unknown;
      caption?: unknown;
      timestamp?: unknown;
      media_type?: unknown;
      media_url?: unknown;
    };
    const id = listedId(row.id);
    if (id === "invalid") return { kind: "unknown" };
    if (id === "skip") continue;
    const mediaUrl = typeof row.media_url === "string" && row.media_url.startsWith("https://")
      ? row.media_url
      : null;
    posts.push({
      id,
      caption: typeof row.caption === "string" ? row.caption : "",
      timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
      mediaType: typeof row.media_type === "string" ? row.media_type : null,
      mediaUrl,
    });
  }
  return { kind: "ok", posts };
}

export async function readInstagramStatus(input: {
  containerId: string;
  userToken: string;
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
  note?: StageNote;
}): Promise<InstagramStatus> {
  if (!NUMERIC_ID.test(input.containerId)) return { kind: "unknown" };
  const timeoutMs = reserveGraphCall(input.budget);
  if (timeoutMs == null) {
    input.note?.({ stage: "container_status", outcome: "skipped", durationMs: 0, httpStatus: null });
    return { kind: "no_budget" };
  }
  const status = await input.http({
    method: "GET",
    path: input.containerId,
    query: { fields: "status_code" },
    token: input.userToken,
    timeoutMs,
    appSecret: input.appSecret,
  });
  if ("timeout" in status) {
    input.note?.({
      stage: "container_status",
      outcome: stageCause(status),
      durationMs: stageElapsed(status),
      httpStatus: null,
    });
    return { kind: "timeout" };
  }
  const code = status.ok && status.body && typeof status.body === "object"
    ? (status.body as { status_code?: unknown }).status_code
    : null;
  const outcome = code === "IN_PROGRESS"
    ? "in_progress"
    : code === "FINISHED"
      ? "finished"
      : code === "ERROR"
        ? "error"
        : code === "EXPIRED"
          ? "expired"
          : code === "PUBLISHED"
            ? "published"
            : "ambiguous";
  input.note?.({
    stage: "container_status",
    outcome,
    durationMs: stageElapsed(status),
    httpStatus: stageHttpStatus(status),
  });
  if (!status.ok || !status.body || typeof status.body !== "object") return { kind: "unknown" };
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
  note?: StageNote;
}): Promise<ProviderOutcome> {
  if (!NUMERIC_ID.test(input.igUserId) || !NUMERIC_ID.test(input.containerId)) {
    return failed("invalid_parameter");
  }
  if (input.budget.remainingMs < INSTAGRAM_PUBLISH_TIMEOUT_MS) {
    input.note?.({ stage: "media_publish", outcome: "skipped", durationMs: 0, httpStatus: null });
    return {
      status: "publishing",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: null,
    };
  }
  const timeoutMs = reserveGraphCall(input.budget, INSTAGRAM_PUBLISH_TIMEOUT_MS);
  if (timeoutMs == null || timeoutMs < INSTAGRAM_PUBLISH_TIMEOUT_MS) {
    input.note?.({ stage: "media_publish", outcome: "skipped", durationMs: 0, httpStatus: null });
    return {
      status: "publishing",
      providerPostId: null,
      providerContainerId: input.containerId,
      safeError: null,
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
    input.note?.({
      stage: "media_publish",
      outcome: stageCause(published),
      durationMs: stageElapsed(published),
      httpStatus: null,
    });
    return ambiguousPublish(input.containerId);
  }
  const failure = definite(published);
  if (failure) {
    input.note?.({
      stage: "media_publish",
      outcome: failure.safeError === "provider_error" ? "provider_error" : "http",
      durationMs: stageElapsed(published),
      httpStatus: stageHttpStatus(published),
    });
    return { ...failure, providerContainerId: input.containerId };
  }
  if (!published.ok || !published.body || typeof published.body !== "object") {
    input.note?.({
      stage: "media_publish",
      outcome: "ambiguous",
      durationMs: stageElapsed(published),
      httpStatus: stageHttpStatus(published),
    });
    return ambiguousPublish(input.containerId);
  }
  const id = postId((published.body as { id?: unknown }).id);
  if (!id) {
    input.note?.({
      stage: "media_publish",
      outcome: "missing_id",
      durationMs: stageElapsed(published),
      httpStatus: stageHttpStatus(published),
    });
    return ambiguousPublish(input.containerId);
  }
  input.note?.({
    stage: "media_publish",
    outcome: "published",
    durationMs: stageElapsed(published),
    httpStatus: stageHttpStatus(published),
  });
  return {
    status: "published",
    providerPostId: id,
    providerContainerId: input.containerId,
    safeError: null,
  };
}
