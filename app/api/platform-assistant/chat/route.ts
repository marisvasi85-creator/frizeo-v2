import { NextResponse } from "next/server";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import {
  isPlatformAssistantEnabled,
  isPlatformAssistantLlmConfigured,
} from "@/lib/platform-assistant/config";
import { runPlatformAssistantChat } from "@/lib/platform-assistant/runChat";
import type { PlatformChatMessage } from "@/lib/platform-assistant/types";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

export async function POST(req: Request) {
  if (!isPlatformAssistantEnabled()) {
    return NextResponse.json(
      { error: "Platform Assistant este disponibil doar pe staging/preview." },
      { status: 404 },
    );
  }

  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  if (!isPlatformAssistantLlmConfigured()) {
    return NextResponse.json(
      {
        error:
          "Platform Assistant nu e configurat. Setează OPENAI_API_KEY sau GEMINI_API_KEY.",
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
    return NextResponse.json(
      { error: "Mesajele sunt obligatorii" },
      { status: 400 },
    );
  }

  const messages: PlatformChatMessage[] = [];
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

  try {
    const result = await runPlatformAssistantChat(messages, {
      userId: auth.userId,
      email: auth.email,
    });

    return NextResponse.json({
      reply: result.reply,
      toolsUsed: result.toolsUsed,
    });
  } catch (error: unknown) {
    console.error("platform-assistant/chat:", error);
    const message =
      error instanceof Error ? error.message : "Eroare la Platform Assistant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
