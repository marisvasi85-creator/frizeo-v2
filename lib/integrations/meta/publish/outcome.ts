export type ProviderSafeError =
  | "missing_permission"
  | "missing_task"
  | "token_expired"
  | "invalid_image"
  | "invalid_parameter"
  | "provider_error"
  | "timeout"
  | "ambiguous"
  | "container_error"
  | "container_expired"
  | "already_published_unconfirmed"
  | "awaiting_publish_confirmation";

export type ProviderOutcome = {
  status: "publishing" | "published" | "failed" | "unknown";
  providerPostId: string | null;
  providerContainerId: string | null;
  safeError: ProviderSafeError | null;
};

export const INSTAGRAM_PUBLISH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
] as const;
