import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/lib/integrations/types";
import {
  createSkeletonAdapter,
  type ProviderAdapter,
} from "@/lib/integrations/providers/contract";

const ADAPTERS: Record<IntegrationProvider, ProviderAdapter> = {
  meta: createSkeletonAdapter("meta"),
  // The Business Profile adapter lives in lib/integrations/google-business.
  // This entry stays closed so Integration Lab cannot publish.
  google_business: createSkeletonAdapter("google_business"),
  tiktok: createSkeletonAdapter("tiktok"),
  whatsapp: createSkeletonAdapter("whatsapp"),
};

export function getProviderAdapter(provider: IntegrationProvider): ProviderAdapter {
  return ADAPTERS[provider];
}

export function listProviderAdapters(): ProviderAdapter[] {
  return INTEGRATION_PROVIDERS.map((provider) => ADAPTERS[provider]);
}
