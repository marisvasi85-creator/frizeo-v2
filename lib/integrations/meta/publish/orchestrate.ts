import { assessStoredTokenExpiry } from "@/lib/integrations/meta/flow";
import { createGraphBudget, type GraphBudget } from "@/lib/integrations/meta/graph";
import { publishFacebookPhoto } from "@/lib/integrations/meta/publish/facebook";
import {
  createInstagramContainer,
  publishInstagramContainer,
  readInstagramStatus,
} from "@/lib/integrations/meta/publish/instagram";
import type { GraphCall, GraphResult } from "@/lib/integrations/meta/publish/graphHttp";
import {
  INSTAGRAM_PUBLISH_SCOPES,
  type ProviderOutcome,
  type ProviderSafeError,
} from "@/lib/integrations/meta/publish/outcome";

export type PublishStatus =
  | "draft"
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled"
  | "unknown";

export type PublishJobState = {
  id: string;
  destinationType: "facebook_page" | "instagram_business";
  providerDestinationId: string;
  status: PublishStatus;
  executionMode: "mock" | "live";
  attempts: number;
  providerPostId: string | null;
  providerContainerId: string | null;
  safeError: string | null;
};

export type SettlePatch = {
  status: "publishing" | "published" | "failed" | "unknown";
  providerPostId?: string | null;
  providerContainerId?: string | null;
  safeError?: ProviderSafeError | null;
};

export type ClaimResult =
  | { outcome: "claimed"; job: PublishJobState }
  | { outcome: "held"; job: PublishJobState }
  | { outcome: "not_found" };

export type SettleResult =
  | { outcome: "updated"; job: PublishJobState }
  | { outcome: "rejected"; job: PublishJobState }
  | { outcome: "not_found" };

function patchFrom(outcome: ProviderOutcome): SettlePatch {
  return {
    status: outcome.status,
    providerPostId: outcome.providerPostId,
    providerContainerId: outcome.providerContainerId,
    safeError: outcome.safeError,
  };
}

async function settleOutcome(
  jobId: string,
  outcome: ProviderOutcome,
  settle: (jobId: string, patch: SettlePatch) => Promise<SettleResult>,
  fallback: PublishJobState,
): Promise<PublishJobState> {
  const settled = await settle(jobId, patchFrom(outcome));
  if (settled.outcome === "not_found") return fallback;
  return settled.job;
}

/**
 * Live work runs only when liveAllowed is true.
 * Start mode calls Graph only for a job claimed from pending in this request.
 * Verify never creates a container and never publishes an unknown job.
 */
export async function advancePublishJobs(input: {
  jobs: PublishJobState[];
  mode: "start" | "verify";
  liveAllowed: boolean;
  userToken: string;
  scopes: readonly string[];
  appSecret: string;
  caption: string;
  tokenExpiresAt: string | null;
  budget?: GraphBudget;
  http: (call: GraphCall) => Promise<GraphResult>;
  claim: (jobId: string) => Promise<ClaimResult>;
  settle: (jobId: string, patch: SettlePatch) => Promise<SettleResult>;
  signImage: () => Promise<string | null>;
  now?: Date;
}): Promise<PublishJobState[]> {
  if (!input.liveAllowed) return input.jobs;
  const budget = input.budget ?? createGraphBudget();
  const now = input.now ?? new Date();
  let signed: Promise<string | null> | null = null;
  const signOnce = () => {
    signed ??= input.signImage();
    return signed;
  };
  const next: PublishJobState[] = [];
  for (const job of input.jobs) {
    next.push(await advanceOne(job));
  }
  return next;

  async function advanceOne(job: PublishJobState): Promise<PublishJobState> {
    if (job.executionMode !== "live") return job;
    if (input.mode === "verify") return verify(job);
    if (job.status !== "pending") return job;
    const claimed = await input.claim(job.id);
    if (claimed.outcome === "not_found") return job;
    if (claimed.outcome === "held") return claimed.job;
    const expiry = assessStoredTokenExpiry(input.tokenExpiresAt, now);
    if (!expiry.ok) {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: null,
          safeError: "token_expired",
        },
        input.settle,
        claimed.job,
      );
    }
    if (job.destinationType === "facebook_page") return runFacebook(claimed.job);
    return runInstagram(claimed.job);
  }

  async function runFacebook(job: PublishJobState): Promise<PublishJobState> {
    if (!input.scopes.includes("pages_manage_posts")) {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: null,
          safeError: "missing_permission",
        },
        input.settle,
        job,
      );
    }
    const imageUrl = await signOnce();
    if (!imageUrl) {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: null,
          safeError: "invalid_image",
        },
        input.settle,
        job,
      );
    }
    const outcome = await publishFacebookPhoto({
      pageId: job.providerDestinationId,
      userToken: input.userToken,
      scopes: input.scopes,
      imageUrl,
      caption: input.caption,
      appSecret: input.appSecret,
      budget,
      http: input.http,
    });
    return settleOutcome(job.id, outcome, input.settle, job);
  }

  async function runInstagram(job: PublishJobState): Promise<PublishJobState> {
    if (INSTAGRAM_PUBLISH_SCOPES.some((scope) => !input.scopes.includes(scope))) {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: null,
          safeError: "missing_permission",
        },
        input.settle,
        job,
      );
    }
    if (job.providerContainerId) return continueInstagram(job, true);
    const imageUrl = await signOnce();
    if (!imageUrl) {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: null,
          safeError: "invalid_image",
        },
        input.settle,
        job,
      );
    }
    const created = await createInstagramContainer({
      igUserId: job.providerDestinationId,
      userToken: input.userToken,
      scopes: input.scopes,
      imageUrl,
      caption: input.caption,
      appSecret: input.appSecret,
      budget,
      http: input.http,
    });
    const stored = await settleOutcome(job.id, created, input.settle, job);
    if (stored.status !== "publishing" || !stored.providerContainerId) return stored;
    return continueInstagram(stored, true);
  }

  async function verify(job: PublishJobState): Promise<PublishJobState> {
    if (job.destinationType === "facebook_page") {
      if (job.status === "publishing") {
        return settleOutcome(
          job.id,
          {
            status: "unknown",
            providerPostId: null,
            providerContainerId: null,
            safeError: "ambiguous",
          },
          input.settle,
          job,
        );
      }
      return job;
    }
    if (job.status === "publishing" && !job.providerContainerId) {
      return settleOutcome(
        job.id,
        {
          status: "unknown",
          providerPostId: null,
          providerContainerId: null,
          safeError: "ambiguous",
        },
        input.settle,
        job,
      );
    }
    if (job.status === "publishing" && job.providerContainerId) {
      return continueInstagram(job, true);
    }
    if (job.status === "unknown" && job.providerContainerId) {
      return continueInstagram(job, false);
    }
    return job;
  }

  async function continueInstagram(
    job: PublishJobState,
    allowPublish: boolean,
  ): Promise<PublishJobState> {
    const containerId = job.providerContainerId;
    if (!containerId) return job;
    const status = await readInstagramStatus({
      containerId,
      userToken: input.userToken,
      appSecret: input.appSecret,
      budget,
      http: input.http,
    });
    if (status.kind === "no_budget" || status.kind === "timeout" || status.kind === "in_progress") {
      return job;
    }
    if (status.kind === "error") {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: containerId,
          safeError: "container_error",
        },
        input.settle,
        job,
      );
    }
    if (status.kind === "expired") {
      return settleOutcome(
        job.id,
        {
          status: "failed",
          providerPostId: null,
          providerContainerId: containerId,
          safeError: "container_expired",
        },
        input.settle,
        job,
      );
    }
    if (status.kind === "published" || !allowPublish || status.kind !== "finished") {
      if (status.kind === "published") {
        return settleOutcome(
          job.id,
          {
            status: "unknown",
            providerPostId: null,
            providerContainerId: containerId,
            safeError: "already_published_unconfirmed",
          },
          input.settle,
          job,
        );
      }
      return job;
    }
    const marked = await input.settle(job.id, {
      status: "unknown",
      providerContainerId: containerId,
      safeError: "awaiting_publish_confirmation",
    });
    if (marked.outcome !== "updated") return marked.outcome === "rejected" ? marked.job : job;
    const published = await publishInstagramContainer({
      igUserId: job.providerDestinationId,
      containerId,
      userToken: input.userToken,
      appSecret: input.appSecret,
      budget,
      http: input.http,
    });
    return settleOutcome(job.id, published, input.settle, marked.job);
  }
}
