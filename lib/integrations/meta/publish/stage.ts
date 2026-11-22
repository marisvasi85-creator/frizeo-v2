export const PUBLISH_STAGES = [
  "container_create",
  "container_status",
  "media_publish",
  "facebook_photo",
  "page_token",
] as const;

export const PUBLISH_STAGE_OUTCOMES = [
  "created",
  "ok",
  "timeout",
  "network",
  "http",
  "in_progress",
  "finished",
  "error",
  "expired",
  "published",
  "ambiguous",
  "provider_error",
  "missing_id",
  "skipped",
] as const;

export type PublishStage = (typeof PUBLISH_STAGES)[number];
export type PublishStageOutcome = (typeof PUBLISH_STAGE_OUTCOMES)[number];

export type PublishStageEvent = {
  stage: PublishStage;
  outcome: PublishStageOutcome;
  durationMs: number;
  httpStatus: number | null;
};

export function stageElapsed(result: { elapsedMs?: number }): number {
  return typeof result.elapsedMs === "number" && result.elapsedMs >= 0
    ? Math.min(60_000, Math.round(result.elapsedMs))
    : 0;
}

export function stageHttpStatus(result: { status?: number }): number | null {
  return typeof result.status === "number" ? result.status : null;
}

export function stageCause(result: { cause?: "timeout" | "network" }): "timeout" | "network" {
  return result.cause === "network" ? "network" : "timeout";
}
