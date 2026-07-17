export function isFrizeoAssistantEnabled(): boolean {
  const explicit = process.env.FRIZEO_ASSISTANT_ENABLED?.trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;

  // Default: available on local + Vercel Preview/staging, never on production.
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  return process.env.VERCEL_ENV === "preview";
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
