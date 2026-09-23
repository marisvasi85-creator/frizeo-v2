import OpenAI from "openai";
import { getPlatformAssistantModel } from "./config";
import { buildPlatformSystemPrompt } from "./systemPrompt";
import {
  getPlatformOpenAIToolDefinitions,
  getPlatformTool,
  PLATFORM_ASSISTANT_TOOLS,
} from "./tools";
import type {
  PlatformChatMessage,
  PlatformRunResult,
  PlatformToolContext,
  PlatformToolResult,
} from "./types";

const MAX_TOOL_ROUNDS = 5;

type ExecutedTool = {
  name: string;
  result: PlatformToolResult;
};

function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getGeminiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    null
  );
}

function isNeedsConfirmation(result: PlatformToolResult): boolean {
  const data = result.data;
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { needs_confirmation?: boolean }).needs_confirmation,
  );
}

const WRITE_TOOLS = new Set([
  "set_tenant_plan",
  "extend_trial",
  "add_tenant_note",
  "send_trial_followup",
  "delete_tenant",
]);

/**
 * Prefer a clear human reply from tool summaries when the model
 * fails to produce a final answer (esp. after writes).
 */
function replyFromToolResults(results: ExecutedTool[]): string | null {
  if (!results.length) return null;

  const writeDone = [...results]
    .reverse()
    .find(
      (r) =>
        WRITE_TOOLS.has(r.name) &&
        r.result.ok &&
        !isNeedsConfirmation(r.result),
    );
  if (writeDone?.result.summary) {
    return writeDone.result.summary;
  }

  const writePropose = [...results]
    .reverse()
    .find(
      (r) =>
        WRITE_TOOLS.has(r.name) &&
        r.result.ok &&
        isNeedsConfirmation(r.result),
    );
  if (writePropose?.result.summary) {
    const warning =
      writePropose.result.data &&
      typeof writePropose.result.data === "object" &&
      (writePropose.result.data as { proposal?: { warning?: string | null } })
        .proposal?.warning;
    return [
      writePropose.result.summary,
      warning ? `⚠️ ${warning}` : null,
      "Confirmi?",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const parts = results
    .map((r) => r.result.summary?.trim())
    .filter((s): s is string => Boolean(s));

  if (!parts.length) return null;
  return parts.join("\n\n");
}

function shouldShortCircuit(results: ExecutedTool[]): boolean {
  return results.some(
    (r) =>
      WRITE_TOOLS.has(r.name) &&
      r.result.ok &&
      !isNeedsConfirmation(r.result),
  );
}

async function executeToolCall(
  name: string,
  rawArgs: string,
  ctx: PlatformToolContext,
): Promise<ExecutedTool> {
  const tool = getPlatformTool(name);
  if (!tool) {
    return {
      name,
      result: {
        ok: false,
        summary: `Tool necunoscut: ${name}`,
        error: "unknown_tool",
      },
    };
  }

  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  const result = await tool.execute(args, ctx);
  return { name, result };
}

async function runWithOpenAI(
  messages: PlatformChatMessage[],
  ctx: PlatformToolContext,
): Promise<PlatformRunResult> {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY lipsă");

  const client = new OpenAI({ apiKey });
  const model = getPlatformAssistantModel();
  const toolsUsed: string[] = [];
  let lastToolResults: ExecutedTool[] = [];

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildPlatformSystemPrompt(ctx) },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const forceAnswer = round === MAX_TOOL_ROUNDS - 1 && lastToolResults.length > 0;

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: openaiMessages,
      ...(forceAnswer
        ? {}
        : {
            tools: getPlatformOpenAIToolDefinitions(),
            tool_choice: "auto" as const,
          }),
    });

    const choice = completion.choices[0]?.message;
    if (!choice) throw new Error("Nu am primit răspuns de la AI");

    const toolCalls = forceAnswer ? undefined : choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = choice.content?.trim();
      if (content) {
        return { reply: content, toolsUsed };
      }
      const fallback = replyFromToolResults(lastToolResults);
      return {
        reply: fallback || "Nu am un răspuns momentan.",
        toolsUsed,
      };
    }

    openaiMessages.push({
      role: "assistant",
      content: choice.content,
      tool_calls: toolCalls,
    });

    const roundResults: ExecutedTool[] = [];
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const executed = await executeToolCall(
        call.function.name,
        call.function.arguments,
        ctx,
      );
      toolsUsed.push(executed.name);
      roundResults.push(executed);
      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(executed.result),
      });
    }

    lastToolResults = roundResults;

    // After a successful plan change, don't wait for another model turn.
    if (shouldShortCircuit(roundResults)) {
      return {
        reply:
          replyFromToolResults(roundResults) ||
          "Actualizare reușită.",
        toolsUsed,
      };
    }
  }

  return {
    reply:
      replyFromToolResults(lastToolResults) ||
      "Am adunat datele, dar nu am putut finaliza răspunsul. Încearcă o întrebare mai specifică.",
    toolsUsed,
  };
}

type GeminiToolDecision =
  | { type: "answer"; content: string }
  | {
      type: "tools";
      calls: Array<{ name: string; arguments: Record<string, unknown> }>;
    };

/**
 * Shown when Gemini keeps failing with a temporary status after retries
 * and the fallback model. Programming errors must not use this message.
 */
export const PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE =
  "Serviciul AI este temporar ocupat. Încearcă din nou peste câteva momente.";

/**
 * Models already called through Gemini `generateContent` in this repo
 * (`lib/marketing-ai/providers/gemini.ts`, GEMINI_FREE_TIER_MODELS).
 * The default fallback is the first entry different from the primary model.
 */
const CONFIRMED_GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
] as const;

const GEMINI_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const GEMINI_PRIMARY_BACKOFF_MS = [400, 900] as const;
const GEMINI_PRIMARY_MAX_RETRIES = 2;

type GeminiGenerateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

class GeminiCallError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(status: number | null, retryable: boolean, message: string) {
    super(message);
    this.name = "GeminiCallError";
    this.status = status;
    this.retryable = retryable;
  }
}

export function isGeminiRetryableHttpStatus(status: number): boolean {
  return GEMINI_RETRYABLE_STATUSES.has(status);
}

/**
 * 400/401/403 (and any other non-retryable status) stay permanent:
 * invalid requests and auth failures will not succeed on another attempt
 * or another model.
 */
export function resolvePlatformAssistantFallbackModel(
  primaryModel: string,
): string | null {
  const configured = process.env.PLATFORM_ASSISTANT_FALLBACK_MODEL?.trim();
  if (configured) {
    return configured === primaryModel ? null : configured;
  }

  return (
    CONFIRMED_GEMINI_MODELS.find((candidate) => candidate !== primaryModel) ??
    null
  );
}

export function redactPlatformAssistantSecrets(
  value: string,
  extraSecret?: string,
): string {
  const secrets = [
    extraSecret,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.OPENAI_API_KEY,
  ];
  let safe = value;
  for (const secret of secrets) {
    const trimmed = secret?.trim();
    if (!trimmed || trimmed.length < 8) continue;
    safe = safe.split(trimmed).join("[redacted]");
  }
  return safe.replace(/([?&]key=)[^&\s"'<>]+/gi, "$1[redacted]");
}

export function toPlatformAssistantClientErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message.trim()
      ? error.message
      : "Eroare la Platform Assistant";
  return redactPlatformAssistantSecrets(raw);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function geminiStatusLabel(error: GeminiCallError): string {
  return error.status == null ? "network" : String(error.status);
}

function logGeminiRetry(model: string, error: GeminiCallError, attempt: number) {
  console.warn(
    `platform-assistant Gemini retry: model=${model} status=${geminiStatusLabel(error)} attempt=${attempt}`,
  );
}

function logGeminiFallback(primary: string, fallback: string) {
  console.warn(
    `platform-assistant Gemini fallback: primary=${primary} fallback=${fallback}`,
  );
}

function logGeminiUnavailable(
  model: string,
  error: GeminiCallError,
  attempt: number,
) {
  console.error(
    `platform-assistant Gemini unavailable: model=${model} status=${geminiStatusLabel(error)} attempt=${attempt}`,
  );
}

function safeProviderMessage(
  status: number,
  rawMessage: string | undefined,
  apiKey: string,
): string {
  const fallback = `Gemini error ${status}`;
  if (!rawMessage?.trim()) return fallback;
  const redacted = redactPlatformAssistantSecrets(rawMessage, apiKey).slice(0, 300);
  return redacted.trim() ? redacted : fallback;
}

function publicGeminiError(error: unknown): Error {
  if (error instanceof GeminiCallError) {
    return new Error(redactPlatformAssistantSecrets(error.message));
  }
  if (error instanceof Error) {
    const redacted = redactPlatformAssistantSecrets(error.message);
    if (redacted === error.message) return error;
    return new Error(redacted);
  }
  return new Error("Eroare la Platform Assistant");
}

async function requestGeminiContent(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new GeminiCallError(null, true, "Gemini network error");
  }

  let json: GeminiGenerateResponse = {};
  try {
    json = (await res.json()) as GeminiGenerateResponse;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const retryable = isGeminiRetryableHttpStatus(res.status);
    throw new GeminiCallError(
      res.status,
      retryable,
      safeProviderMessage(res.status, json.error?.message, apiKey),
    );
  }

  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) throw new Error("Răspuns Gemini gol");
  return text;
}

async function callGeminiModelWithRetries(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const maxAttempts = GEMINI_PRIMARY_MAX_RETRIES + 1;
  let lastError: GeminiCallError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestGeminiContent(apiKey, model, prompt);
    } catch (error: unknown) {
      if (!(error instanceof GeminiCallError) || !error.retryable) {
        throw error;
      }
      lastError = error;
      if (attempt >= maxAttempts) break;
      logGeminiRetry(model, error, attempt + 1);
      const backoff = GEMINI_PRIMARY_BACKOFF_MS[attempt - 1] ?? 900;
      await sleep(backoff);
    }
  }

  throw lastError ?? new GeminiCallError(null, true, "Gemini error");
}

async function callGeminiJson(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  try {
    return await callGeminiModelWithRetries(apiKey, model, prompt);
  } catch (error: unknown) {
    if (!(error instanceof GeminiCallError) || !error.retryable) {
      throw publicGeminiError(error);
    }

    const fallback = resolvePlatformAssistantFallbackModel(model);
    if (!fallback) {
      logGeminiUnavailable(model, error, GEMINI_PRIMARY_MAX_RETRIES + 1);
      throw new Error(PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
    }

    logGeminiFallback(model, fallback);

    try {
      return await requestGeminiContent(apiKey, fallback, prompt);
    } catch (fallbackError: unknown) {
      if (fallbackError instanceof GeminiCallError && fallbackError.retryable) {
        logGeminiUnavailable(fallback, fallbackError, 1);
        throw new Error(PLATFORM_ASSISTANT_PROVIDER_BUSY_MESSAGE);
      }
      throw publicGeminiError(fallbackError);
    }
  }
}

function parseGeminiDecision(raw: string): GeminiToolDecision {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as {
    type?: string;
    content?: string;
    calls?: Array<{ name?: string; arguments?: Record<string, unknown> }>;
  };

  if (parsed.type === "tools" && Array.isArray(parsed.calls)) {
    return {
      type: "tools",
      calls: parsed.calls
        .filter((c) => typeof c.name === "string")
        .map((c) => ({
          name: c.name as string,
          arguments: c.arguments ?? {},
        })),
    };
  }

  return {
    type: "answer",
    content:
      typeof parsed.content === "string" && parsed.content.trim()
        ? parsed.content.trim()
        : "Nu am un răspuns momentan.",
  };
}

async function runWithGemini(
  messages: PlatformChatMessage[],
  ctx: PlatformToolContext,
): Promise<PlatformRunResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY lipsă");

  const model =
    process.env.PLATFORM_ASSISTANT_MODEL?.trim() ||
    process.env.FRIZEO_ASSISTANT_MODEL?.trim() ||
    process.env.MARKETING_AI_MODEL?.trim() ||
    "gemini-3.1-flash-lite";

  const toolsUsed: string[] = [];
  const toolCatalog = PLATFORM_ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  let toolMemory = "";
  let lastToolResults: ExecutedTool[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const history = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const forceAnswer =
      round === MAX_TOOL_ROUNDS - 1 && lastToolResults.length > 0;

    const prompt = `${buildPlatformSystemPrompt(ctx)}

Tool-uri disponibile (JSON):
${JSON.stringify(toolCatalog, null, 2)}

${toolMemory ? `Rezultate tool anterioare:\n${toolMemory}\n` : ""}

Istoric conversație:
${history}

${
  forceAnswer
    ? `IMPORTANT: Ai deja rezultatele tool. Răspunde DOAR cu:
{"type":"answer","content":"răspunsul final clar pentru utilizator"}`
    : `Răspunde DOAR cu JSON valid:
{"type":"tools","calls":[{"name":"tool_name","arguments":{}}]}
{"type":"answer","content":"răspunsul final"}

După set_tenant_plan confirmat (fără needs_confirmation), răspunde imediat cu type=answer.`
}`;

    const raw = await callGeminiJson(apiKey, model, prompt);
    const decision = parseGeminiDecision(raw);

    if (decision.type === "answer") {
      return { reply: decision.content, toolsUsed };
    }

    if (forceAnswer) {
      break;
    }

    const results: ExecutedTool[] = [];
    for (const call of decision.calls) {
      const executed = await executeToolCall(
        call.name,
        JSON.stringify(call.arguments ?? {}),
        ctx,
      );
      toolsUsed.push(executed.name);
      results.push(executed);
    }
    lastToolResults = results;
    toolMemory += `${JSON.stringify(results, null, 2)}\n`;

    if (shouldShortCircuit(results)) {
      return {
        reply:
          replyFromToolResults(results) || "Actualizare reușită.",
        toolsUsed,
      };
    }
  }

  return {
    reply:
      replyFromToolResults(lastToolResults) ||
      "Am adunat datele, dar nu am putut finaliza răspunsul. Încearcă pe scurt.",
    toolsUsed,
  };
}

export async function runPlatformAssistantChat(
  messages: PlatformChatMessage[],
  ctx: PlatformToolContext,
): Promise<PlatformRunResult> {
  if (messages.length === 0) throw new Error("Mesaj lipsă");

  if (getOpenAIKey()) return runWithOpenAI(messages, ctx);
  if (getGeminiKey()) return runWithGemini(messages, ctx);

  throw new Error(
    "Platform Assistant nu este configurat. Adaugă OPENAI_API_KEY sau GEMINI_API_KEY.",
  );
}
