import { NextResponse } from "next/server";
import {
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import { runAssistantChat } from "@/lib/assistant/runChat";
import type { AssistantChatMessage } from "@/lib/assistant/types";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

export async function POST(req: Request) {
  if (!isFrizeoAssistantEnabled()) {
    return NextResponse.json(
      { error: "Frizeo Assistant este disponibil doar pe staging." },
      { status: 404 },
    );
  }

  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  if (!isAssistantLlmConfigured()) {
    return NextResponse.json(
      {
        error:
          "Assistant-ul nu e configurat. Setează OPENAI_API_KEY sau GEMINI_API_KEY pe staging.",
      },
      { status: 503 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Mesajele sunt obligatorii" }, { status: 400 });
  }

  const messages: AssistantChatMessage[] = [];
  for (const item of body.messages.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const trimmed = content.trim();
    if (!trimmed) continue;
    messages.push({
      role,
      content: trimmed.slice(0, MAX_CONTENT_LENGTH),
    });
  }

  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json(
      { error: "Ultimul mesaj trebuie să fie de la utilizator" },
      { status: 400 },
    );
  }

  const barberId = await getCurrentBarberId(auth.user.id, auth.tenantId);

  try {
    const result = await runAssistantChat(messages, {
      tenantId: auth.tenantId,
      userId: auth.user.id,
      role: auth.role,
      barberId,
    });

    return NextResponse.json({
      reply: result.reply,
      toolsUsed: result.toolsUsed,
    });
  } catch (error: unknown) {
    console.error("assistant/chat:", error);
    const message =
      error instanceof Error ? error.message : "Eroare la Frizeo Assistant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
