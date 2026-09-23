import { isGeminiRetryableError } from "./providers/gemini";

export function shouldUseTemplateFallback(message: string): boolean {
  const lower = message.toLowerCase();
  if (isGeminiRetryableError(message)) return true;
  return (
    lower.includes("abort") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("429") ||
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("indisponibil") ||
    lower.includes("răspuns ai") ||
    lower.includes("json") ||
    lower.includes("gemini") ||
    lower.includes("cotă") ||
    lower.includes("quota")
  );
}

export function publicGenerateError(message: string): string {
  if (shouldUseTemplateFallback(message)) {
    return "Generatorul nu a răspuns. Încearcă din nou.";
  }
  if (/api[_ ]?key|sk-|AIza|authorization|bearer /i.test(message)) {
    return "Generatorul nu este disponibil momentan.";
  }
  if (
    message.length > 180 ||
    /vercel|gemini_api_key|openai_api_key|marketing_ai_model/i.test(message)
  ) {
    return "Nu am putut genera textul. Încearcă din nou.";
  }
  return message;
}
