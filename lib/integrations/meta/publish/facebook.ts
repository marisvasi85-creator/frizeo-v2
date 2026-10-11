import { reserveGraphCall, type GraphBudget } from "@/lib/integrations/meta/graph";
import { graphErrorCode, type GraphCall, type GraphResult } from "@/lib/integrations/meta/publish/graphHttp";
import type { ProviderOutcome } from "@/lib/integrations/meta/publish/outcome";

const NUMERIC_ID = /^[0-9]{1,32}$/;
const POST_ID = /^[0-9]{1,32}(?:_[0-9]{1,32})?$/;

export const FACEBOOK_PUBLISH_SCOPE = "pages_manage_posts";
export const FACEBOOK_PUBLISH_TASK = "CREATE_CONTENT";

function failed(safeError: ProviderOutcome["safeError"]): ProviderOutcome {
  return {
    status: "failed",
    providerPostId: null,
    providerContainerId: null,
    safeError,
  };
}

function unknown(): ProviderOutcome {
  return {
    status: "unknown",
    providerPostId: null,
    providerContainerId: null,
    safeError: "ambiguous",
  };
}

function readPageGrant(body: unknown): { pageToken: string; tasks: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const token = (body as { access_token?: unknown }).access_token;
  const tasks = (body as { tasks?: unknown }).tasks;
  if (typeof token !== "string" || token.length < 8) return null;
  if (!Array.isArray(tasks) || tasks.some((task) => typeof task !== "string")) return null;
  return { pageToken: token, tasks: tasks as string[] };
}

function readPostId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const postId = (body as { post_id?: unknown }).post_id;
  if (typeof postId === "string" && POST_ID.test(postId)) return postId;
  return null;
}

function definiteFailure(result: GraphResult): ProviderOutcome | null {
  if ("timeout" in result) return null;
  const code = graphErrorCode(result.body);
  if (code === 190) return failed("token_expired");
  if (code === 200) return failed("missing_permission");
  if (code === 324) return failed("invalid_image");
  if (code === 100) return failed("invalid_parameter");
  if (!result.ok && result.status >= 400 && result.status < 500 && code != null) {
    return failed("provider_error");
  }
  return null;
}

/**
 * Page token stays in this function. Callers receive only the post outcome.
 * A missing pages_manage_posts scope returns before any Graph call.
 */
export async function publishFacebookPhoto(input: {
  pageId: string;
  userToken: string;
  scopes: readonly string[];
  imageUrl: string;
  caption: string;
  appSecret: string;
  budget: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
}): Promise<ProviderOutcome> {
  if (!input.scopes.includes(FACEBOOK_PUBLISH_SCOPE)) return failed("missing_permission");
  if (!NUMERIC_ID.test(input.pageId)) return failed("invalid_parameter");
  if (!input.imageUrl.startsWith("https://")) return failed("invalid_image");

  const pageTimeout = reserveGraphCall(input.budget);
  if (pageTimeout == null) return failed("timeout");
  const page = await input.http({
    method: "GET",
    path: input.pageId,
    query: { fields: "access_token,tasks" },
    token: input.userToken,
    timeoutMs: pageTimeout,
    appSecret: input.appSecret,
  });
  if ("timeout" in page) return failed("timeout");
  const pageFailure = definiteFailure(page);
  if (pageFailure) return pageFailure;
  if (!page.ok) return failed("provider_error");

  const grant = readPageGrant(page.body);
  if (!grant) return failed("missing_task");
  if (!grant.tasks.includes(FACEBOOK_PUBLISH_TASK)) return failed("missing_task");

  const postTimeout = reserveGraphCall(input.budget);
  if (postTimeout == null) return failed("timeout");
  const posted = await input.http({
    method: "POST",
    path: `${input.pageId}/photos`,
    form: { url: input.imageUrl, caption: input.caption },
    token: grant.pageToken,
    timeoutMs: postTimeout,
    appSecret: input.appSecret,
  });
  if ("timeout" in posted) return unknown();
  const postFailure = definiteFailure(posted);
  if (postFailure) return postFailure;
  if (!posted.ok) return unknown();
  const postId = readPostId(posted.body);
  if (!postId) return unknown();
  return {
    status: "published",
    providerPostId: postId,
    providerContainerId: null,
    safeError: null,
  };
}
