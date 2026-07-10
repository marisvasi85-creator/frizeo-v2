import type {
  GenerateMarketingInput,
  GenerateMarketingResult,
  MarketingContext,
} from "./types";
import { buildMarketingPrompt } from "./prompts";
import {
  getMarketingAIProvider,
  getMarketingAIProviderConfig,
  isMarketingAIConfigured,
} from "./providers";
import { generateTemplateContent } from "./providers/template";
import { isGeminiQuotaError } from "./providers/gemini";

export { isMarketingAIConfigured, getMarketingAIStatus } from "./providers";

function parseModelJson(raw: string): GenerateMarketingResult {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as Partial<GenerateMarketingResult>;

  if (!parsed.content || typeof parsed.content !== "string") {
    throw new Error("Răspuns AI invalid");
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title : "Conținut generat",
    content: parsed.content,
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((tag): tag is string => typeof tag === "string")
      : [],
    callToAction:
      typeof parsed.callToAction === "string"
        ? parsed.callToAction
        : "Programează-te online!",
  };
}

export async function generateMarketingContent(
  context: MarketingContext,
  input: GenerateMarketingInput,
): Promise<GenerateMarketingResult & { usedTemplateFallback?: boolean; fallbackWarning?: string }> {
  const config = getMarketingAIProviderConfig();

  if (config.provider === "template") {
    return generateTemplateContent(context, input);
  }

  const provider = getMarketingAIProvider();
  if (!provider.isConfigured()) {
    throw new Error(
      "Marketing AI nu este configurat. Verifică variabilele de environment pentru provider.",
    );
  }

  const prompt = buildMarketingPrompt(context, input);

  try {
    const raw = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "Ești un expert în marketing pentru frizerii din România. Răspunzi doar cu JSON valid.",
        },
        { role: "user", content: prompt },
      ],
      jsonMode: true,
      temperature: config.temperature,
    });

    return parseModelJson(raw);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la generare";

    if (config.provider === "gemini" && isGeminiQuotaError(message)) {
      const fallback = generateTemplateContent(context, input);
      return {
        ...fallback,
        usedTemplateFallback: true,
        fallbackWarning:
          "Gemini nu are cotă disponibilă acum — am folosit text demo. " +
          "Setează MARKETING_AI_MODEL=gemini-2.5-flash-lite sau creează o cheie nouă în AI Studio (fără billing).",
      };
    }

    throw error;
  }
}
