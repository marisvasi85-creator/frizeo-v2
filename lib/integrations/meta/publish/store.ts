import type { ClaimResult, SettlePatch, SettleResult } from "@/lib/integrations/meta/publish/orchestrate";
import type { ProviderSafeError } from "@/lib/integrations/meta/publish/outcome";
import {
  asRecord,
  presentPublishJob,
  toJobState,
  type PublicPublishJob,
} from "@/lib/integrations/meta/publish/present";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type { PublicPublishJob } from "@/lib/integrations/meta/publish/present";
export { presentPublishJob, publicJobResponse, toJobState } from "@/lib/integrations/meta/publish/present";

export type PrepareResult =
  | { outcome: "created" | "replay"; jobs: PublicPublishJob[] }
  | { outcome: "idempotency_conflict" | "destination_mismatch" | "invalid" | "failed" };

function parseJobs(value: unknown): PublicPublishJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const job = presentPublishJob(item);
    return job ? [job] : [];
  });
}

export async function preparePublishJobs(input: {
  tenantId: string;
  createdBy: string;
  idempotencyKey: string;
  caption: string;
  mediaObjectPath: string;
  destinationIds: string[];
  executionMode: "mock" | "live";
}): Promise<PrepareResult> {
  const { data, error } = await supabaseAdmin.rpc("meta_publish_prepare", {
    p_tenant_id: input.tenantId,
    p_created_by: input.createdBy,
    p_idempotency_key: input.idempotencyKey,
    p_caption: input.caption,
    p_media_object_path: input.mediaObjectPath,
    p_destination_ids: input.destinationIds,
    p_execution_mode: input.executionMode,
  });
  if (error) {
    console.error("meta_publish_prepare_failed");
    return { outcome: "failed" };
  }
  const row = asRecord(data);
  const outcome = row?.outcome;
  if (outcome === "created" || outcome === "replay") {
    return { outcome, jobs: parseJobs(row?.jobs) };
  }
  if (
    outcome === "idempotency_conflict" ||
    outcome === "destination_mismatch" ||
    outcome === "invalid"
  ) {
    return { outcome };
  }
  return { outcome: "failed" };
}

export async function claimPublishJob(tenantId: string, jobId: string): Promise<ClaimResult> {
  const { data, error } = await supabaseAdmin.rpc("meta_publish_claim", {
    p_tenant_id: tenantId,
    p_job_id: jobId,
  });
  if (error) {
    console.error("meta_publish_claim_failed");
    return { outcome: "not_found" };
  }
  const row = asRecord(data);
  const job = presentPublishJob(row?.job);
  if (row?.outcome === "claimed" && job) return { outcome: "claimed", job: toJobState(job) };
  if (row?.outcome === "held" && job) return { outcome: "held", job: toJobState(job) };
  return { outcome: "not_found" };
}

export async function settlePublishJob(
  tenantId: string,
  jobId: string,
  patch: SettlePatch,
): Promise<SettleResult> {
  const { data, error } = await supabaseAdmin.rpc("meta_publish_settle", {
    p_tenant_id: tenantId,
    p_job_id: jobId,
    p_status: patch.status,
    p_provider_post_id: patch.providerPostId ?? null,
    p_provider_container_id: patch.providerContainerId ?? null,
    p_safe_error: patch.safeError ?? null,
  });
  if (error) {
    console.error("meta_publish_settle_failed");
    return { outcome: "not_found" };
  }
  const row = asRecord(data);
  const job = presentPublishJob(row?.job);
  if (!job) return { outcome: "not_found" };
  const state = toJobState(job);
  if (row?.outcome === "updated") return { outcome: "updated", job: state };
  if (row?.outcome === "rejected") return { outcome: "rejected", job: state };
  return { outcome: "not_found" };
}

export async function readPublishJob(
  tenantId: string,
  jobId: string,
): Promise<PublicPublishJob | null> {
  const { data, error } = await supabaseAdmin
    .from("integration_publish_jobs")
    .select(
      "id, campaign_id, asset_id, destination_id, status, execution_mode, attempts, provider_post_id, provider_container_id, safe_error, idempotency_key, marketing_destinations!inner(destination_type, display_name, provider_destination_id, tenant_id), integration_assets!inner(body, tenant_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("meta_publish_job_read_failed");
    return null;
  }
  const destination = asRecord(
    Array.isArray(data.marketing_destinations)
      ? data.marketing_destinations[0]
      : data.marketing_destinations,
  );
  const asset = asRecord(
    Array.isArray(data.integration_assets)
      ? data.integration_assets[0]
      : data.integration_assets,
  );
  if (destination?.tenant_id !== tenantId || asset?.tenant_id !== tenantId) return null;
  return presentPublishJob({
    id: data.id,
    campaign_id: data.campaign_id,
    asset_id: data.asset_id,
    destination_id: data.destination_id,
    destination_type: destination?.destination_type,
    display_name: destination?.display_name,
    provider_destination_id: destination?.provider_destination_id,
    status: data.status,
    execution_mode: data.execution_mode,
    attempts: data.attempts,
    provider_post_id: data.provider_post_id,
    provider_container_id: data.provider_container_id,
    safe_error: data.safe_error,
    idempotency_key: data.idempotency_key,
    caption: asset?.body,
  });
}

export async function readPublishMediaCandidate(
  tenantId: string,
  assetId: string,
): Promise<{ eligible: true; path: string } | { eligible: false }> {
  const { data, error } = await supabaseAdmin.rpc("meta_publish_media_candidate", {
    p_tenant_id: tenantId,
    p_asset_id: assetId,
  });
  if (error) {
    console.error("meta_publish_media_candidate_failed");
    return { eligible: false };
  }
  const row = asRecord(data);
  if (row?.eligible !== true || typeof row.media_object_path !== "string") {
    return { eligible: false };
  }
  return { eligible: true, path: row.media_object_path };
}

export async function clearPublishMedia(tenantId: string, assetId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("meta_publish_media_clear", {
    p_tenant_id: tenantId,
    p_asset_id: assetId,
  });
  if (error) {
    console.error("meta_publish_media_clear_failed");
    return false;
  }
  return asRecord(data)?.cleared === true;
}

export function isSafeError(value: string | null): value is ProviderSafeError {
  return value === "missing_permission" ||
    value === "missing_task" ||
    value === "token_expired" ||
    value === "invalid_image" ||
    value === "invalid_parameter" ||
    value === "provider_error" ||
    value === "timeout" ||
    value === "ambiguous" ||
    value === "container_error" ||
    value === "container_expired" ||
    value === "already_published_unconfirmed" ||
    value === "awaiting_publish_confirmation";
}
