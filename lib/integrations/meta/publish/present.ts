import type { PublishJobState } from "@/lib/integrations/meta/publish/orchestrate";

export type PublicPublishJob = {
  id: string;
  assetId: string;
  campaignId: string;
  destinationId: string;
  destinationType: "facebook_page" | "instagram_business";
  displayName: string | null;
  providerDestinationId: string;
  status: PublishJobState["status"];
  executionMode: "mock" | "live";
  attempts: number;
  providerPostId: string | null;
  providerContainerId: string | null;
  safeError: string | null;
  idempotencyKey: string | null;
  caption: string | null;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function presentPublishJob(value: unknown): PublicPublishJob | null {
  const row = asRecord(value);
  if (!row) return null;
  const destinationType = row.destination_type;
  const status = row.status;
  const executionMode = row.execution_mode;
  if (destinationType !== "facebook_page" && destinationType !== "instagram_business") return null;
  if (
    status !== "draft" &&
    status !== "pending" &&
    status !== "publishing" &&
    status !== "published" &&
    status !== "failed" &&
    status !== "cancelled" &&
    status !== "unknown" &&
    status !== "released"
  ) {
    return null;
  }
  if (executionMode !== "mock" && executionMode !== "live") return null;
  if (typeof row.id !== "string" || typeof row.destination_id !== "string") return null;
  if (typeof row.provider_destination_id !== "string") return null;
  return {
    id: row.id,
    assetId: asText(row.asset_id) ?? "",
    campaignId: asText(row.campaign_id) ?? "",
    destinationId: row.destination_id,
    destinationType,
    displayName: asText(row.display_name),
    providerDestinationId: row.provider_destination_id,
    status,
    executionMode,
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    providerPostId: asText(row.provider_post_id),
    providerContainerId: asText(row.provider_container_id),
    safeError: asText(row.safe_error),
    idempotencyKey: asText(row.idempotency_key),
    caption: asText(row.caption),
  };
}

export function toJobState(job: PublicPublishJob): PublishJobState {
  return {
    id: job.id,
    destinationType: job.destinationType,
    providerDestinationId: job.providerDestinationId,
    status: job.status,
    executionMode: job.executionMode,
    attempts: job.attempts,
    providerPostId: job.providerPostId,
    providerContainerId: job.providerContainerId,
    safeError: job.safeError,
  };
}

export function publicJobResponse(job: PublicPublishJob, externalCall: boolean) {
  return {
    id: job.id,
    assetId: job.assetId,
    destinationId: job.destinationId,
    destinationType: job.destinationType,
    displayName: job.displayName,
    status: job.status,
    executionMode: job.executionMode,
    safeError: job.safeError,
    providerPostId: job.providerPostId,
    providerContainerId: job.providerContainerId,
    caption: job.caption,
    externalCall,
  };
}
