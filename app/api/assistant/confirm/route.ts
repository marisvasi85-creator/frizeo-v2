import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import {
  isAssistantLlmConfigured,
  isFrizeoAssistantEnabled,
} from "@/lib/assistant/config";
import { buildAssistantToolContext } from "@/lib/assistant/buildToolContext";
import { confirmAssistantAction } from "@/lib/assistant/runChat";

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

  let body: { confirmationId?: unknown; accept?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const confirmationId =
    typeof body.confirmationId === "string" ? body.confirmationId.trim() : "";
  if (!confirmationId) {
    return NextResponse.json(
      { error: "confirmationId este obligatoriu" },
      { status: 400 },
    );
  }

  const accept = body.accept !== false && body.accept !== "false";

  const toolContext = await buildAssistantToolContext({
    tenantId: auth.tenantId,
    userId: auth.user.id,
    role: auth.role,
  });

  try {
    const result = await confirmAssistantAction(
      confirmationId,
      toolContext,
      accept,
    );

    return NextResponse.json({
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      pendingConfirmation: result.pendingConfirmation ?? null,
    });
  } catch (error: unknown) {
    console.error("assistant/confirm:", error);
    const message =
      error instanceof Error ? error.message : "Eroare la confirmare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
