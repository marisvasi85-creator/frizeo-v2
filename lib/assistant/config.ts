import {
  isDevelopment,
  isPreview,
  isProduction,
  isStaging,
} from "@/lib/app/environment";

export function isFrizeoAssistantEnabled(): boolean {
  const explicit = process.env.FRIZEO_ASSISTANT_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  if (isProduction()) return false;
  return isStaging() || isPreview() || isDevelopment();
}

export function getAssistantModel(): string {
  return (
    process.env.FRIZEO_ASSISTANT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.MARKETING_AI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export function isAssistantLlmConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim(),
  );
}
