export const INTEGRATION_PROVIDERS = [
  "meta",
  "google_business",
  "tiktok",
  "whatsapp",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  meta: "Instagram & Facebook",
  google_business: "Google Business",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export const PUBLISH_CAPABILITY = {
  meta: "marketing.publish.meta",
  google_business: "marketing.publish.google_business",
  tiktok: "marketing.publish.tiktok",
  whatsapp: "marketing.publish.whatsapp",
} as const;

export type ConnectionStatus =
  | "not_connected"
  | "connected"
  | "needs_reconnect"
  | "error"
  | "setup_required";

export type PublicConnection = {
  id: string;
  provider: IntegrationProvider;
  displayName: string | null;
  status: ConnectionStatus;
  scopes: string[];
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
};

export type PublishJobStatus =
  | "draft"
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export function isIntegrationProvider(
  value: string,
): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}
