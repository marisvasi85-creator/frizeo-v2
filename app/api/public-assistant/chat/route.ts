import { NextResponse } from "next/server";
import {
  isPublicBookingAssistantEnabled,
  isPublicBookingAssistantLlmConfigured,
} from "@/lib/public-assistant/config";
import { checkPublicAssistantRateLimit } from "@/lib/public-assistant/rateLimit";
import { runPublicBookingAssistantChat } from "@/lib/public-assistant/runChat";
import type { PublicChatMessage } from "@/lib/public-assistant/types";
import { resolveTenantBySlug } from "@/lib/slugs/slugRedirects";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_MESSAGES = 16;
const MAX_CONTENT_LENGTH = 1200;

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  if (!isPublicBookingAssistantEnabled()) {
    return NextResponse.json(
      { error: "Asistentul de programări e disponibil pe staging." },
      { status: 404 },
    );
  }

  if (!isPublicBookingAssistantLlmConfigured()) {
    return NextResponse.json(
      {
        error:
          "Asistentul nu e configurat. Setează OPENAI_API_KEY sau GEMINI_API_KEY.",
      },
      { status: 503 },
    );
  }

  let body: {
    messages?: unknown;
    salonSlug?: unknown;
    barberSlug?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const salonSlug =
    typeof body.salonSlug === "string" ? body.salonSlug.trim().toLowerCase() : "";
  if (!salonSlug) {
    return NextResponse.json({ error: "salonSlug e obligatoriu" }, { status: 400 });
  }

  const rate = checkPublicAssistantRateLimit(`${clientIp(req)}:${salonSlug}`);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Prea multe mesaje. Încearcă din nou mai târziu." },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      },
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Mesajele sunt obligatorii" }, { status: 400 });
  }

  const messages: PublicChatMessage[] = [];
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

  const resolved = await resolveTenantBySlug(salonSlug);
  if (!resolved) {
    return NextResponse.json({ error: "Salon inexistent" }, { status: 404 });
  }

  const tenant = resolved.tenant;
  const barberSlug =
    typeof body.barberSlug === "string"
      ? body.barberSlug.trim().toLowerCase()
      : "";

  let barberId: string | null = null;
  let barberName: string | null = null;
  let resolvedBarberSlug: string | null = null;

  if (barberSlug) {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id, display_name, slug, active")
      .eq("tenant_id", tenant.id)
      .eq("slug", barberSlug)
      .eq("active", true)
      .maybeSingle();
    if (barber) {
      barberId = barber.id;
      barberName = barber.display_name;
      resolvedBarberSlug = barber.slug;
    }
  }

  try {
    const result = await runPublicBookingAssistantChat(messages, {
      tenantId: tenant.id,
      salonName: tenant.name,
      salonSlug: resolved.canonicalSlug,
      barberId,
      barberName,
      barberSlug: resolvedBarberSlug,
    });

    return NextResponse.json({
      reply: result.reply,
      toolsUsed: result.toolsUsed,
    });
  } catch (error: unknown) {
    console.error("public-assistant/chat:", error);
    const message =
      error instanceof Error ? error.message : "Eroare la asistentul de programări";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
