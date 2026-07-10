import OpenAI from "openai";
import type {
  GenerateMarketingInput,
  GenerateMarketingResult,
  MarketingContext,
} from "./types";
import { buildMarketingPrompt } from "./prompts";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

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
): Promise<GenerateMarketingResult> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error(
      "Marketing AI nu este configurat. Adaugă OPENAI_API_KEY în environment.",
    );
  }

  const prompt = buildMarketingPrompt(context, input);

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content:
          "Ești un expert în marketing pentru frizerii din România. Răspunzi doar cu JSON valid.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const message = completion.choices[0]?.message?.content;
  if (!message) {
    throw new Error("Nu am primit răspuns de la AI");
  }

  return parseModelJson(message);
}

export function isMarketingAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}
