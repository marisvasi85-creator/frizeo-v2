import type {
  IntegrationProvider,
  PublishJobStatus,
} from "@/lib/integrations/types";

export type MockPublishJob = {
  provider: IntegrationProvider;
  status: PublishJobStatus;
  providerPostId: null;
  providerUrl: null;
  externalCall: false;
  attempts: number;
};

/**
 * Local draft only. Does not call a provider and does not mark the job published.
 */
export function createMockPublishJob(input: {
  provider: IntegrationProvider;
}): MockPublishJob {
  return {
    provider: input.provider,
    status: "draft",
    providerPostId: null,
    providerUrl: null,
    externalCall: false,
    attempts: 0,
  };
}
