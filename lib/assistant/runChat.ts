import OpenAI from "openai";
import { getAssistantModel } from "./config";
import { extractNeedsConfirmation } from "./extractConfirmation";
import { buildAssistantSystemPrompt } from "./systemPrompt";
import {
  ASSISTANT_TOOLS,
  getAssistantTool,
  getOpenAIToolDefinitions,
} from "./tools";
import { asBoolean } from "./tools/helpers";
import type {
  AssistantChatMessage,
  AssistantPendingConfirmationPublic,
  AssistantRunResult,
  AssistantToolContext,
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

function sanitizeToolArgs(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Record<string, unknown> {
  if (ctx.allowConfirmed) return args;
  if (!asBoolean(args.confirmed)) return args;
  return { ...args, confirmed: false };
}

async function executeToolCall(
  name: string,
  rawArgs: string,
  ctx: AssistantToolContext,
) {
  const tool = getAssistantTool(name);
  if (!tool) {
    return {
      name,
      args: {} as Record<string, unknown>,
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

  args = sanitizeToolArgs(args, ctx);
  const result = await tool.execute(args, ctx);
  return { name, args, result };
}

function confirmationReply(summary: string): string {
  return `${summary}\n\nApasă Confirmă sau Renunță mai jos.`;
}

async function runWithOpenAI(
  messages: AssistantChatMessage[],
  ctx: AssistantToolContext,
): Promise<AssistantRunResult> {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY lipsă");

  const client = new OpenAI({ apiKey });
  const model = getAssistantModel();
  const toolsUsed: string[] = [];
  let pendingConfirmation: AssistantPendingConfirmationPublic | null = null;

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildAssistantSystemPrompt(ctx) },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: openaiMessages,
      tools: getOpenAIToolDefinitions(),
      tool_choice: "auto",
    });

    const choice = completion.choices[0]?.message;
    if (!choice) {
      throw new Error("Nu am primit răspuns de la AI");
    }

    const toolCalls = choice.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        reply: choice.content?.trim() || "Nu am un răspuns momentan.",
        toolsUsed,
        pendingConfirmation,
      };
    }

    openaiMessages.push({
      role: "assistant",
      content: choice.content,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const executed = await executeToolCall(
        call.function.name,
        call.function.arguments,
        ctx,
      );
      toolsUsed.push(executed.name);

      const extracted = extractNeedsConfirmation(
        executed.name,
        executed.args,
        executed.result,
        ctx,
      );

      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(executed.result),
      });

      if (extracted) {
        pendingConfirmation = extracted.publicPending;
        return {
          reply: confirmationReply(executed.result.summary),
          toolsUsed,
          pendingConfirmation,
        };
      }
    }
  }

  return {
    reply:
      "Am adunat datele, dar nu am putut finaliza răspunsul. Încearcă din nou cu o întrebare mai specifică.",
    toolsUsed,
    pendingConfirmation,
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
        temperature: 0.3,
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
  messages: AssistantChatMessage[],
  ctx: AssistantToolContext,
): Promise<AssistantRunResult> {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY lipsă");

  const model =
    process.env.FRIZEO_ASSISTANT_MODEL?.trim() ||
    process.env.MARKETING_AI_MODEL?.trim() ||
    "gemini-3.1-flash-lite";

  const toolsUsed: string[] = [];
  let pendingConfirmation: AssistantPendingConfirmationPublic | null = null;
  const toolCatalog = ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  let toolMemory = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const history = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `${buildAssistantSystemPrompt(ctx)}

Tool-uri disponibile (JSON):
${JSON.stringify(toolCatalog, null, 2)}

${toolMemory ? `Rezultate tool anterioare:\n${toolMemory}\n` : ""}

Istoric conversație:
${history}

Răspunde DOAR cu JSON valid în unul din formatele:
{"type":"tools","calls":[{"name":"tool_name","arguments":{}}]}
{"type":"answer","content":"răspunsul final pentru utilizator"}

Dacă ai deja suficiente date în rezultatele tool, răspunde cu type=answer.
Dacă ai nevoie de date, alege type=tools.
Nu seta confirmed=true — confirmările se fac din butoanele din UI.`;

    const raw = await callGeminiJson(apiKey, model, prompt);
    const decision = parseGeminiDecision(raw);

    if (decision.type === "answer") {
      return {
        reply: decision.content,
        toolsUsed,
        pendingConfirmation,
      };
    }

    const results = [];
    for (const call of decision.calls) {
      const executed = await executeToolCall(
        call.name,
        JSON.stringify(call.arguments ?? {}),
        ctx,
      );
      toolsUsed.push(executed.name);
      results.push(executed);

      const extracted = extractNeedsConfirmation(
        executed.name,
        executed.args,
        executed.result,
        ctx,
      );
      if (extracted) {
        pendingConfirmation = extracted.publicPending;
        return {
          reply: confirmationReply(executed.result.summary),
          toolsUsed,
          pendingConfirmation,
        };
      }
    }
    toolMemory += `${JSON.stringify(results, null, 2)}\n`;
  }

  return {
    reply:
      "Am adunat datele, dar nu am putut finaliza răspunsul. Încearcă din nou cu o întrebare pe scurt.",
    toolsUsed,
    pendingConfirmation,
  };
}

export async function runAssistantChat(
  messages: AssistantChatMessage[],
  ctx: AssistantToolContext,
): Promise<AssistantRunResult> {
  if (messages.length === 0) {
    throw new Error("Mesaj lipsă");
  }

  if (getOpenAIKey()) {
    return runWithOpenAI(messages, ctx);
  }

  if (getGeminiKey()) {
    return runWithGemini(messages, ctx);
  }

  throw new Error(
    "Frizeo Assistant nu este configurat. Adaugă OPENAI_API_KEY sau GEMINI_API_KEY.",
  );
}

export async function confirmAssistantAction(
  confirmationId: string,
  ctx: AssistantToolContext,
  accept: boolean,
): Promise<AssistantRunResult> {
  const { consumePendingConfirmation } = await import("./pendingConfirmations");

  const pending = consumePendingConfirmation({
    id: confirmationId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });

  if (!pending) {
    return {
      reply: "Confirmarea a expirat sau nu mai e validă. Reia acțiunea.",
      toolsUsed: [],
      pendingConfirmation: null,
    };
  }

  if (!accept) {
    return {
      reply: "Am renunțat. Nu s-a modificat nimic.",
      toolsUsed: [],
      pendingConfirmation: null,
    };
  }

  const tool = getAssistantTool(pending.toolName);
  if (!tool) {
    return {
      reply: `Nu mai pot rula acțiunea (${pending.toolName}).`,
      toolsUsed: [],
      pendingConfirmation: null,
    };
  }

  const result = await tool.execute(
    { ...pending.args, confirmed: true },
    { ...ctx, allowConfirmed: true },
  );

  return {
    reply: result.summary,
    toolsUsed: [pending.toolName],
    pendingConfirmation: null,
  };
}
