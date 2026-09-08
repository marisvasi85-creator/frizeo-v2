import {
  isDevelopment,
  isPreview,
  isProduction,
  isStaging,
} from "@/lib/app/environment";

/**
 * Platform (creator) assistant — separate from salon Frizeo Assistant.
 * Default: on for staging/preview/dev; off on production unless flagged.
 */
export function isPlatformAssistantEnabled(): boolean {
  const explicit = process.env.PLATFORM_ASSISTANT_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  if (isProduction()) return false;
  return isStaging() || isPreview() || isDevelopment();
}

export function getPlatformAssistantModel(): string {
  return (
    process.env.PLATFORM_ASSISTANT_MODEL?.trim() ||
    process.env.FRIZEO_ASSISTANT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.MARKETING_AI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export function isPlatformAssistantLlmConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim(),
  );
}
