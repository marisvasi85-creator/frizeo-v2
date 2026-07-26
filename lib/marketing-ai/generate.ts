import type {
  GenerateMarketingInput,
  GenerateMarketingResult,
  MarketingContext,
} from "./types";
import { MARKETING_VARIANT_COUNT } from "./types";
import { buildMarketingPrompt } from "./prompts";
import {
  getMarketingAIProvider,
  getMarketingAIProviderConfig,
  isMarketingAIConfigured,
} from "./providers";
import { generateTemplateVariants } from "./providers/template";
import { isGeminiRetryableError } from "./providers/gemini";

export { isMarketingAIConfigured, getMarketingAIStatus } from "./providers";

function normalizeResult(
  parsed: Partial<GenerateMarketingResult>,
): GenerateMarketingResult {
  if (!parsed.content || typeof parsed.content !== "string") {
    throw new Error("Răspuns AI invalid");
  }

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : "Conținut generat",
    content: parsed.content.trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.replace(/^#/, "").trim())
          .filter(Boolean)
          .slice(0, 12)
      : [],
    callToAction:
      typeof parsed.callToAction === "string" && parsed.callToAction.trim()
        ? parsed.callToAction.trim().slice(0, 160)
        : "Programează-te online!",
  };
}

function parseModelVariants(
  raw: string,
  expectedCount: number,
): GenerateMarketingResult[] {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as
    | { variants?: Partial<GenerateMarketingResult>[] }
    | Partial<GenerateMarketingResult>;

  if (
    parsed &&
    typeof parsed === "object" &&
    "variants" in parsed &&
    Array.isArray(parsed.variants)
  ) {
    const variants = parsed.variants
      .slice(0, expectedCount)
      .map((item) => normalizeResult(item));
    if (!variants.length) throw new Error("Răspuns AI fără variante");
    return variants;
  }

  // Backward compat: single object
  return [normalizeResult(parsed as Partial<GenerateMarketingResult>)];
}

export type GenerateMarketingOutput = {
  variants: GenerateMarketingResult[];
  result: GenerateMarketingResult;
  usedTemplateFallback?: boolean;
  fallbackWarning?: string;
};

export async function generateMarketingContent(
  context: MarketingContext,
  input: GenerateMarketingInput,
): Promise<GenerateMarketingOutput> {
  const config = getMarketingAIProviderConfig();
  const variantCount = Math.min(
    Math.max(input.variantCount ?? MARKETING_VARIANT_COUNT, 1),
    MARKETING_VARIANT_COUNT,
  );
  const normalizedInput = { ...input, variantCount };

  if (config.provider === "template") {
    const variants = generateTemplateVariants(context, normalizedInput);
    return { variants, result: variants[0] };
  }

  const provider = getMarketingAIProvider();
  if (!provider.isConfigured()) {
    throw new Error(
      "Marketing AI nu este configurat. Verifică variabilele de environment pentru provider.",
    );
  }

  const prompt = buildMarketingPrompt(context, normalizedInput);

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

    const variants = parseModelVariants(raw, variantCount);
    // Pad with template variants if model returned fewer than expected
    if (variants.length < variantCount) {
      const fillers = generateTemplateVariants(context, normalizedInput).slice(
        variants.length,
      );
      variants.push(...fillers.slice(0, variantCount - variants.length));
    }

    return { variants, result: variants[0] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare la generare";

    if (config.provider === "gemini" && isGeminiRetryableError(message)) {
      const variants = generateTemplateVariants(context, normalizedInput);
      return {
        variants,
        result: variants[0],
        usedTemplateFallback: true,
        fallbackWarning:
          "Gemini indisponibil momentan — am folosit text demo. " +
          "Setează MARKETING_AI_MODEL=gemini-3.1-flash-lite în Vercel.",
      };
    }

    throw error;
  }
}
