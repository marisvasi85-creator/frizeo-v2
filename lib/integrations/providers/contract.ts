import type { IntegrationProvider } from "@/lib/integrations/types";

export type NotImplemented = {
  implemented: false;
  reason: "not_implemented";
};

export type ProviderAdapter = {
  provider: IntegrationProvider;
  getDestinations(): Promise<NotImplemented>;
  validateConnection(): Promise<NotImplemented>;
  publish(): Promise<NotImplemented>;
  revoke(): Promise<NotImplemented>;
};

function notImplemented(): Promise<NotImplemented> {
  return Promise.resolve({ implemented: false, reason: "not_implemented" });
}

export function createSkeletonAdapter(
  provider: IntegrationProvider,
): ProviderAdapter {
  return {
    provider,
    getDestinations: notImplemented,
    validateConnection: notImplemented,
    publish: notImplemented,
    revoke: notImplemented,
  };
}
