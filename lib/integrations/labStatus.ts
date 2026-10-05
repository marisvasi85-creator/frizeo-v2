import {
  PUBLISH_CAPABILITY,
  type IntegrationProvider,
} from "@/lib/integrations/types";
import type { FrizeoV2Capability } from "@/lib/integrations/capabilities";
import { safeErrorText } from "@/lib/integrations/redaction";

export type LabOAuthState =
  | "not_implemented"
  | "not_configured"
  | "configured"
  | "error";

export type LabPublishState = "not_implemented" | "mock" | "available";

export type LabProviderStatus = {
  provider: IntegrationProvider;
  feature: "enabled" | "disabled";
  oauth: LabOAuthState;
  connectionsCount: number;
  destinationsCount: number;
  publish: LabPublishState;
  lastValidation: string | null;
  lastSafeError: string | null;
};

export function validationPlan(): { runnable: false; reason: "not_implemented" } {
  return { runnable: false, reason: "not_implemented" };
}

export function buildLabProviderStatus(input: {
  provider: IntegrationProvider;
  explicitEnables: readonly string[];
  connectionsCount: number;
  destinationsCount: number;
  lastValidation: string | null;
  lastError: string | null;
}): LabProviderStatus {
  const capability: FrizeoV2Capability = PUBLISH_CAPABILITY[input.provider];
  return {
    provider: input.provider,
    feature: input.explicitEnables.includes(capability) ? "enabled" : "disabled",
    oauth: "not_implemented",
    connectionsCount: input.connectionsCount,
    destinationsCount: input.destinationsCount,
    publish: "not_implemented",
    lastValidation: input.lastValidation,
    lastSafeError: safeErrorText(input.lastError),
  };
}
