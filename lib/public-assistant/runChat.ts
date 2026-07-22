import OpenAI from "openai";
import { getPublicBookingAssistantModel } from "./config";
import { buildPublicSystemPrompt } from "./systemPrompt";
import {
  getPublicOpenAIToolDefinitions,
  getPublicTool,
  PUBLIC_ASSISTANT_TOOLS,
} from "./tools";
import type {
  PublicChatMessage,
  PublicRunResult,
  PublicToolContext,
  PublicToolResult,
} from "./types";

const MAX_TOOL_ROUNDS = 4;

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

async function executeToolCall(
  name: string,
  rawArgs: string,
  ctx: PublicToolContext,
): Promise<{ name: string; result: PublicToolResult }> {
  const tool = getPublicTool(name);
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

function replyFromToolResults(
  results: Array<{ name: string; result: PublicToolResult }>,
): string | null {
  const parts = results
    .map((r) => r.result.summary?.trim())
    .filter((s): s is string => Boolean(s));
  if (!parts.length) return null;
  return parts.join("\n\n");
}

async function runWithOpenAI(
  messages: PublicChatMessage[],
  ctx: PublicToolContext,
): Promise<PublicRunResult> {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY lipsă");

  const client = new OpenAI({ apiKey });
  const model = getPublicBookingAssistantModel();
  const toolsUsed: string[] = [];
  let lastToolResults: Array<{ name: string; result: PublicToolResult }> = [];

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildPublicSystemPrompt(ctx) },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const forceAnswer =
      round === MAX_TOOL_ROUNDS - 1 && lastToolResults.length > 0;

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.35,
      messages: openaiMessages,
      ...(forceAnswer
        ? {}
        : {
            tools: getPublicOpenAIToolDefinitions(),
            tool_choice: "auto" as const,
          }),
    });

    const choice = completion.choices[0]?.message;
    if (!choice) throw new Error("Nu am primit răspuns de la AI");

    const toolCalls = forceAnswer ? undefined : choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = choice.content?.trim();
      if (content) return { reply: content, toolsUsed };
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

    lastToolResults = [];
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const executed = await executeToolCall(
        call.function.name,
        call.function.arguments,
        ctx,
      );
      toolsUsed.push(executed.name);
      lastToolResults.push(executed);
      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(executed.result),
      });
    }
  }

  return {
    reply:
      replyFromToolResults(lastToolResults) ||
      "Am adunat datele. Poți alege serviciul și ora din formularul de pe pagină.",
    toolsUsed,
  };
}

type GeminiToolDecision =
  | { type: "answer"; content: string }
  | {
      type: "tools";
      calls: Array<{ name: string; arguments: Record<string, unknown> }>;
    };

async function callGeminiJson(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Gemini error ${res.status}`);
  }

  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) throw new Error("Răspuns Gemini gol");
  return text;
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
        .filter((c) => c.name)
        .map((c) => ({
          name: c.name!,
          arguments: c.arguments || {},
        })),
    };
  }

  return {
    type: "answer",
    content: parsed.content?.trim() || "Nu am un răspuns momentan.",
  };
}

async function runWithGemini(
  messages: PublicChatMessage[],
  ctx: PublicToolContext,
): Promise<PublicRunResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY lipsă");

  const model =
    process.env.PUBLIC_BOOKING_ASSISTANT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash";

  const toolsUsed: string[] = [];
  let lastToolResults: Array<{ name: string; result: PublicToolResult }> = [];
  const history = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const toolCatalog = PUBLIC_ASSISTANT_TOOLS.map(
    (t) => `- ${t.name}: ${t.description}`,
  ).join("\n");

  let toolMemory = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const prompt = `${buildPublicSystemPrompt(ctx)}

Tool-uri disponibile:
${toolCatalog}

Istoric chat:
${history}
${toolMemory ? `\nRezultate tool:\n${toolMemory}` : ""}

Răspunde DOAR JSON:
{"type":"answer","content":"..."}
sau
{"type":"tools","calls":[{"name":"...","arguments":{...}}]}`;

    const raw = await callGeminiJson(apiKey, model, prompt);
    const decision = parseGeminiDecision(raw);

    if (decision.type === "answer") {
      return { reply: decision.content, toolsUsed };
    }

    lastToolResults = [];
    for (const call of decision.calls.slice(0, 3)) {
      const executed = await executeToolCall(
        call.name,
        JSON.stringify(call.arguments || {}),
        ctx,
      );
      toolsUsed.push(executed.name);
      lastToolResults.push(executed);
      toolMemory += `\n${call.name}: ${JSON.stringify(executed.result)}`;
    }
  }

  return {
    reply:
      replyFromToolResults(lastToolResults) ||
      "Am adunat datele. Continuă pe formularul din pagină.",
    toolsUsed,
  };
}

export async function runPublicBookingAssistantChat(
  messages: PublicChatMessage[],
  ctx: PublicToolContext,
): Promise<PublicRunResult> {
  if (getOpenAIKey()) return runWithOpenAI(messages, ctx);
  if (getGeminiKey()) return runWithGemini(messages, ctx);
  throw new Error("Nicio cheie AI configurată (OPENAI_API_KEY / GEMINI_API_KEY)");
}
